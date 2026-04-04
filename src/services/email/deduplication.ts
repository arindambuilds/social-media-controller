import { redisConnection } from "../../lib/redis";

function getRedis() {
  if (!redisConnection) {
    throw new Error("Email deduplication requires Redis.");
  }
  return redisConnection;
}

export async function isDuplicate(key: string, ttlSeconds = 3600): Promise<boolean> {
  const result = await getRedis().set(`email:dedup:${key}`, "1", "EX", ttlSeconds, "NX");
  return result !== "OK";
}

export function generateDeduplicationKey(emailType: string, identifier: string, bucket: string): string {
  return `${emailType}:${identifier}:${bucket}`;
}
