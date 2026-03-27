import crypto from "crypto";
import { redisConnection } from "../lib/redis";

const ttlSeconds = 600;

export async function issueOAuthState(context: Record<string, string>): Promise<string> {
  const state = crypto.randomBytes(32).toString("hex");
  await redisConnection.set(`oauth-state:${state}`, JSON.stringify(context), "EX", ttlSeconds);
  return state;
}

export async function consumeOAuthState(state: string): Promise<Record<string, string> | null> {
  const key = `oauth-state:${state}`;
  const payload = await redisConnection.get(key);
  if (!payload) {
    return null;
  }

  await redisConnection.del(key);
  return JSON.parse(payload) as Record<string, string>;
}
