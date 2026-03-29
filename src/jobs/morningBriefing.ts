import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { generateBriefing } from "../services/briefingAgent";
import { getBriefingData } from "../services/briefingData";
import { sendEmail, sendWhatsApp } from "../services/whatsappSender";

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
  const text = await generateBriefing(data);
  const sentAt = new Date();

  const wa = client.whatsappNumber?.trim();
  if (wa) {
    await sendWhatsApp(wa, text);
  } else {
    console.log(`[MorningBriefing] skip WhatsApp (no number) client=${clientId}`);
  }

  await sendEmail(client.owner.email, "Your morning briefing", text);

  await prisma.briefing.create({
    data: {
      clientId,
      content: text,
      sentAt
    }
  });

  return text;
}

async function runOneClient(clientId: string): Promise<void> {
  try {
    await runBriefingNow(clientId);
    console.log(`[MorningBriefing] success clientId=${clientId}`);
  } catch (err) {
    console.log(`[MorningBriefing] failed clientId=${clientId}`, {
      message: err instanceof Error ? err.message : String(err)
    });
  }
}

/**
 * 08:00 Asia/Kolkata daily — matches “morning briefing” product copy.
 */
export function startMorningBriefingJob(): void {
  cron.schedule(
    "0 8 * * *",
    async () => {
      const clients = await prisma.client.findMany({
        where: { briefingEnabled: true },
        select: { id: true }
      });
      console.log(`[MorningBriefing] cron tick — ${clients.length} client(s)`);
      await Promise.allSettled(clients.map((c) => runOneClient(c.id)));
    },
    { timezone: "Asia/Kolkata" }
  );
}
