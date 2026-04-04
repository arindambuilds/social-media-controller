import { Router } from "express";
import type { Request, Response } from "express";
import { dispatchEmailFromAgent } from "../agents/emailDispatcher";
import { prisma } from "../lib/prisma";
import { verifyAccessToken } from "../auth/jwt";
import { createTranscriptAttachment } from "../agents/pdfAttachmentHelper";
import { extractEmailFromText, resolveRecipient } from "../agents/recipientResolver";
import { runOrchestrator } from "../agents/orchestrator";

type MessageBody = {
  message?: string;
  context?: Record<string, unknown>;
  requestEmailOnCompletion?: boolean;
  recipientEmail?: string;
  attachTranscript?: boolean;
  emailSubject?: string;
};

export const messageRouter = Router();

type RouteUser = { id: string; email?: string };

async function resolveRouteUser(
  req: Request<Record<string, string>, unknown, MessageBody>
): Promise<RouteUser | undefined> {
  if (req.auth?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { id: true, email: true }
    });
    return user ?? { id: req.auth.userId };
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  try {
    const auth = verifyAccessToken(header.slice(7));
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { id: true, email: true }
    });
    return user ?? { id: auth.sub, email: auth.email };
  } catch {
    return undefined;
  }
}

messageRouter.post("/", async (req: Request<Record<string, string>, unknown, MessageBody>, res: Response) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const routeUser = await resolveRouteUser(req);
    const result = await runOrchestrator(message, req.body.context, {
      user: routeUser,
      requestedRecipient: req.body.recipientEmail
    });

    if (req.body.requestEmailOnCompletion) {
      const recipient = resolveRecipient({
        userEmail: routeUser?.email,
        requestProvided: req.body.recipientEmail || undefined,
        contextExtracted: extractEmailFromText(result.finalReply) || undefined,
        fallback: process.env.DEFAULT_ALERT_EMAIL || undefined
      });

      if (recipient) {
        const attachments = req.body.attachTranscript
          ? [
              await createTranscriptAttachment(`message-${routeUser?.id ?? Date.now()}`, [
                { role: "user", content: message, timestamp: new Date() },
                { role: "assistant", content: result.finalReply, timestamp: new Date() }
              ])
            ]
          : undefined;

        await dispatchEmailFromAgent({
          enabled: true,
          type: "notification",
          to: recipient,
          subject: req.body.emailSubject || "Quadrapilot message response",
          data: {
            title: "Quadrapilot Message",
            body: result.finalReply
          },
          attachments
        });
      }
    }

    res.json({
      reply: result.finalReply,
      emailAction: result.emailAction ?? null,
      emailRequested: Boolean(req.body.requestEmailOnCompletion)
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
