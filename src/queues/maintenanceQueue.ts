import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";
import { queueNames } from "./queueNames";

export type MaintenanceJob = Record<string, never>;

export const maintenanceQueue: Queue<MaintenanceJob> | null =
  redisConnection != null
    ? new Queue<MaintenanceJob>(queueNames.maintenance, { connection: redisConnection })
    : null;

/** Idempotent weekly DB cleanup (Sunday 02:00 Asia/Kolkata). */
export async function registerWeeklyDatabaseCleanupJob(): Promise<void> {
  if (!maintenanceQueue) return;
  await maintenanceQueue.add(
    "db-cleanup",
    {},
    {
      repeat: { pattern: "0 2 * * 0", tz: "Asia/Kolkata" },
      jobId: "repeat:weekly-db-cleanup"
    }
  );
}
