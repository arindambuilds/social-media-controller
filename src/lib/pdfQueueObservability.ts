let enqueueAgency = 0;
let enqueueClient = 0;
let enqueueDefault = 0;

/** Call after each successful `pdfQueue.add` — pass role tier (10 / 50 / 100), not BullMQ score. */
export function recordPdfEnqueueByTier(tier: number): void {
  if (tier >= 100) enqueueAgency++;
  else if (tier >= 50) enqueueClient++;
  else enqueueDefault++;
}

export function takeAndResetEnqueueCounters(): { agency: number; client: number; free: number } {
  const snap = { agency: enqueueAgency, client: enqueueClient, free: enqueueDefault };
  enqueueAgency = 0;
  enqueueClient = 0;
  enqueueDefault = 0;
  return snap;
}
