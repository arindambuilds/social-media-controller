import type Redis from "ioredis";
import { sendWhatsAppStrict } from "./whatsappSender";
import type { WhatsAppSendBriefJob } from "../queues/whatsappSendQueue";

function idempotencyKey(phone: string, dateStr: string): string {
  const n = phone.replace(/^whatsapp:/i, "").trim().toLowerCase();
  return `wa:brief:delivered:${dateStr}:${n}`;
}

export type WhatsAppSendDeps = {
  /** Returns "OK" if lock acquired, null if key already exists. */
  redisSetNx: (key: string, ttlSec: number) => Promise<string | null>;
  redisSet: (key: string, value: string, ttlSec: number) => Promise<void>;
  redisDel: (key: string) => Promise<void>;
  sendTwilio: (to: string, body: string) => Promise<void>;
};

/**
 * Twilio-only send with Redis idempotency (same dateStr+phone → second job skips Twilio).
 */
export async function executeWhatsAppSendJob(
  data: WhatsAppSendBriefJob,
  deps: WhatsAppSendDeps
): Promise<void> {
  const key = idempotencyKey(data.phoneE164, data.dateStr);
  const locked = await deps.redisSetNx(key, 172800);
  if (locked !== "OK") return;
  try {
    await deps.sendTwilio(data.phoneE164, data.briefingText);
    await deps.redisSet(key, "1", 172800);
  } catch (e) {
    await deps.redisDel(key);
    throw e;
  }
}

export function whatsappSendDepsFromRedis(redis: Redis): WhatsAppSendDeps {
  return {
    redisSetNx: async (k, ttlSec) => redis.set(k, "pending", "EX", ttlSec, "NX"),
    redisSet: async (k, v, ttlSec) => {
      await redis.set(k, v, "EX", ttlSec);
    },
    redisDel: async (k) => {
      await redis.del(k);
    },
    sendTwilio: sendWhatsAppStrict
  };
}
