import { prisma } from "../lib/prisma";
import { logSystemEvent } from "../services/systemEventService";
import { briefingQueue, enqueueBriefingJob } from "../queues/briefingQueue";
import { runBriefingNow } from "./morningBriefing";

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

async function runWithConcurrency(tasks: Array<() => Promise<void>>, concurrency: number): Promise<void> {
  let next = 0;
  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++;
      await tasks[i]();
    }
  }
  const n = Math.max(1, Math.min(concurrency, tasks.length || 1));
  await Promise.all(Array.from({ length: tasks.length ? n : 0 }, () => worker()));
}

/**
 * Scheduler entry (Quadra Cycle 2): IST hour tick — Claude + persistence run in `runBriefingNow`
 * (or per-client briefing jobs). WhatsApp text delivery is handed to `whatsapp-send` worker when Redis queue is enabled.
 */
export async function runMorningBriefingDispatchTick(): Promise<void> {
  const hour = currentHourIst();
  const clients = await prisma.client.findMany({
    where: { briefingEnabled: true, briefingHourIst: hour },
    select: { id: true }
  });
  console.log(`[MorningBriefing] dispatch tick IST hour=${hour} — ${clients.length} client(s)`);
  const tasks = clients.map((c) => () => dispatchBriefingForClient(c.id));
  if (briefingQueue) {
    await Promise.allSettled(tasks.map((t) => t()));
  } else {
    await runWithConcurrency(tasks, 3);
  }
}
