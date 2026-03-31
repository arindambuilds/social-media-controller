import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { generateBriefing } from "../services/briefingAgent";
import { getBriefingData } from "../services/briefingData";
import {
  buildBriefingEmailSubject,
  buildBriefingEmailHtml,
  buildWhatsAppBriefingBody,
  briefingPlainTextFallback,
  briefingTipSentence,
  fullBriefingToEmailHtml
} from "../services/briefingDelivery";
import { sendBriefingEmailHtml, sendWhatsApp } from "../services/whatsappSender";
import { publishPulseEvent } from "../lib/pulseEvents";
import { whatsappSendQueue } from "../queues/whatsappSendQueue";
import { isDebugBriefing } from "../lib/debugBriefing";

function istDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/**
 * Generates briefing text, delivers WhatsApp + email (best-effort), persists row.
 * WhatsApp: when `whatsappSendQueue` is active and not in test, enqueues `send-brief` for Twilio-only worker (Claude already ran above).
 * @throws if client is missing or DB write fails
 */
export async function runBriefingNow(clientId: string): Promise<string> {
  if (isDebugBriefing()) {
    console.log("[briefing] Starting for clientId:", clientId);
  }
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { owner: { select: { email: true } } }
  });
  if (!client) {
    throw new Error("Client not found");
  }

  const data = await getBriefingData(clientId);
  const { content: text, claudeSucceeded } = await generateBriefing(data);
  if (isDebugBriefing()) {
    console.log("[briefing] Claude response length:", text.length);
  }
  const tip = briefingTipSentence(text, claudeSucceeded);
  const waBody = buildWhatsAppBriefingBody(data, tip);
  const sentAt = new Date();

  let whatsappDelivered: boolean | null = null;
  const wa = client.whatsappNumber?.trim();
  if (wa) {
    const useQueue = Boolean(whatsappSendQueue && process.env.NODE_ENV !== "test");
    if (useQueue) {
      const dateStr = istDateString();
      await whatsappSendQueue!.add(
        "send-brief",
        { phoneE164: wa, briefingText: waBody, dateStr },
        {
          jobId: `wa-brief:${clientId}:${dateStr}`,
          attempts: 5,
          backoff: { type: "exponential", delay: 1000 }
        }
      );
      if (isDebugBriefing()) {
        console.log("[briefing] Job enqueued. Queue: whatsapp-send, name: send-brief");
      }
      whatsappDelivered = null;
    } else {
      whatsappDelivered = await sendWhatsApp(wa, waBody);
    }
  }

  let emailDelivered: boolean | null = null;
  const ownerEmail = client.owner.email?.trim();
  if (ownerEmail) {
    const subject = buildBriefingEmailSubject(data.businessName);
    const base = env.APP_BASE_URL.replace(/\/$/, "");
    const dashboardUrl = `${base}/dashboard`;
    const unsubscribeUrl = dashboardUrl;
    const html = buildBriefingEmailHtml({
      businessName: data.businessName,
      newFollowers: data.newFollowers,
      likesYesterday: data.likesYesterday,
      commentsYesterday: data.commentsYesterday,
      aiTip: tip,
      fullBriefingHtml: fullBriefingToEmailHtml(text),
      unsubscribeUrl,
      dashboardUrl
    });
    const plain = briefingPlainTextFallback(data, tip, text);
    emailDelivered = await sendBriefingEmailHtml({
      to: ownerEmail,
      subject,
      text: plain,
      html
    });
  }

  const metricsPayload = {
    newFollowers: data.newFollowers,
    likesYesterday: data.likesYesterday,
    commentsYesterday: data.commentsYesterday,
    totalFollowers: data.totalFollowers,
    businessName: data.businessName
  };

  const created = await prisma.briefing.create({
    data: {
      clientId,
      content: text,
      sentAt,
      whatsappDelivered,
      emailDelivered,
      tipText: tip,
      metricsJson: metricsPayload as object,
      status: "COMPLETE"
    }
  });

  await publishPulseEvent(clientId, "briefing.complete", {
    briefingId: created.id,
    sentAt: sentAt.toISOString()
  });

  return text;
}

/** node-cron fallback when `REDIS_URL` is unset — avoids double-firing with BullMQ repeatable. */
export function startMorningBriefingJob(): void {
  const expr = process.env.BRIEFING_CRON_EXPRESSION?.trim() || "0 * * * *";
  cron.schedule(
    expr,
    async () => {
      const { runMorningBriefingDispatchTick } = await import("./scheduleMorningBriefing");
      await runMorningBriefingDispatchTick();
    },
    { timezone: "Asia/Kolkata" }
  );
  if (isDebugBriefing() && expr !== "0 * * * *") {
    console.log("[scheduler] BRIEFING_CRON_EXPRESSION active:", expr);
  }
}
