import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { redisConnection } from "../lib/redis";
import { generateBriefing } from "../lib/claudeClient";
import { whatsappSendQueue } from "../queues/whatsappSendQueue";
import { onPulseBriefingSent } from "../services/pulseRetention";
import { publishPulseEvent } from "../lib/pulseEvents";
import { logger } from "../lib/logger";

function istDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/**
 * Bilingual briefing path: Claude JSON { en, or } → WhatsApp queue → Briefing row.
 * Uses the same `send-brief` job name as the existing Twilio worker.
 */
export async function runBriefingDispatchNow(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      whatsappNumber: true,
      language: true,
      briefingStreakLastDateIst: true,
      briefingStreakCurrent: true,
      briefingStreakBest: true
    }
  });
  if (!client) {
    throw new Error("Client not found");
  }

  const { en, or } = await generateBriefing(clientId, client.language ?? "en");
  const waBody = client.language === "or" ? or : en;
  const sentAt = new Date();

  let whatsappDelivered: boolean | null = null;
  const wa = client.whatsappNumber?.trim();
  if (wa) {
    const useQueue = Boolean(whatsappSendQueue && process.env.NODE_ENV !== "test");
    const dateStr = istDateString();
    if (useQueue) {
      await whatsappSendQueue!.add(
        "send-brief",
        { phoneE164: wa, briefingText: waBody, dateStr },
        {
          jobId: `wa-brief-dispatch:${clientId}:${dateStr}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 }
        }
      );
      whatsappDelivered = null;
    } else {
      const { sendWhatsApp } = await import("../services/whatsappSender");
      whatsappDelivered = await sendWhatsApp(wa, waBody);
    }
  }

  const content = JSON.stringify({ en, or, primary: client.language === "or" ? "or" : "en" });

  const created = await prisma.briefing.create({
    data: {
      clientId,
      content,
      sentAt,
      whatsappDelivered,
      emailDelivered: null,
      tipText: waBody.slice(0, 500),
      metricsJson: { bilingual: true, enLen: en.length, orLen: or.length } as object,
      status: "COMPLETE",
      pulseTierSnapshot: null
    }
  });

  await onPulseBriefingSent(clientId);
  await publishPulseEvent(clientId, "briefing.complete", {
    briefingId: created.id,
    sentAt: sentAt.toISOString(),
    bilingual: true
  });
}

let morningCron: ReturnType<typeof cron.schedule> | null = null;

/**
 * Opt-in: set `PULSE_BILINGUAL_CRON=1` (no Redis only). Production with Redis uses BullMQ + `morningBriefing` instead.
 */
export function scheduleMorningBriefing(): void {
  if (process.env.PULSE_BILINGUAL_CRON !== "1") {
    return;
  }
  if (redisConnection) {
    logger.warn("[briefingDispatch] PULSE_BILINGUAL_CRON ignored when Redis is configured");
    return;
  }
  if (morningCron) return;
  morningCron = cron.schedule(
    "0 9 * * *",
    () => {
      void (async () => {
        const clients = await prisma.client.findMany({
          where: { briefingEnabled: true },
          select: { id: true }
        });
        for (const c of clients) {
          try {
            await runBriefingDispatchNow(c.id);
          } catch (e) {
            logger.warn("[briefingDispatch] morning run failed", {
              clientId: c.id,
              message: e instanceof Error ? e.message : String(e)
            });
          }
        }
      })();
    },
    { timezone: "Asia/Kolkata" }
  );
  logger.info("[briefingDispatch] node-cron 09:00 IST registered (no Redis)");
}
