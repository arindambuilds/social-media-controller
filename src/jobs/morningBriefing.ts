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
import { logSystemEvent } from "../services/systemEventService";
import { briefingQueue, enqueueBriefingJob } from "../queues/briefingQueue";
import { publishPulseEvent } from "../lib/pulseEvents";

/**
 * Generates briefing text, delivers WhatsApp + email (best-effort), persists row.
 * @throws if client is missing or DB write fails
 */
export async function runBriefingNow(clientId: string): Promise<string> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { owner: { select: { email: true } } }
  });
  if (!client) {
    throw new Error("Client not found");
  }

  const data = await getBriefingData(clientId);
  const { content: text, claudeSucceeded } = await generateBriefing(data);
  const tip = briefingTipSentence(text, claudeSucceeded);
  const waBody = buildWhatsAppBriefingBody(data, tip);
  const sentAt = new Date();

  let whatsappDelivered: boolean | null = null;
  const wa = client.whatsappNumber?.trim();
  if (wa) {
    whatsappDelivered = await sendWhatsApp(wa, waBody);
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

function currentHourIst(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false
  }).formatToParts(new Date());
  const raw = parts.find((p) => p.type === "hour")?.value ?? "0";
  return Number(raw);
}

async function dispatchBriefingForClient(clientId: string): Promise<void> {
  try {
    if (briefingQueue) {
      await enqueueBriefingJob(clientId);
    } else {
      await runBriefingNow(clientId);
    }
    console.log(`[MorningBriefing] queued or completed clientId=${clientId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[MorningBriefing] failed clientId=${clientId}`, { message });
    await logSystemEvent("briefing", "error", message, { clientId });
  }
}

/**
 * Every hour at :00 Asia/Kolkata — runs briefing for clients whose `briefingHourIst` matches.
 */
export function startMorningBriefingJob(): void {
  cron.schedule(
    "0 * * * *",
    async () => {
      const hour = currentHourIst();
      const clients = await prisma.client.findMany({
        where: { briefingEnabled: true, briefingHourIst: hour },
        select: { id: true }
      });
      console.log(`[MorningBriefing] cron tick IST hour=${hour} — ${clients.length} client(s)`);
      await Promise.allSettled(clients.map((c) => dispatchBriefingForClient(c.id)));
    },
    { timezone: "Asia/Kolkata" }
  );
}
