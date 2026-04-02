import { Router } from "express";
import type { Request, Response } from "express";
import { runOrchestrator } from "../agents/orchestrator";

type MessageBody = { message?: string };

export const messageRouter = Router();

messageRouter.post("/", async (req: Request<unknown, unknown, MessageBody>, res: Response) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const { output } = await runOrchestrator(message);
    res.json({ reply: output });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

