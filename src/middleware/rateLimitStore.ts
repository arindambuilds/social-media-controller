import RedisStore from "rate-limit-redis";
import { redisConnection } from "../lib/redis";

export function createOptionalRedisRateLimitStore(prefix: string): RedisStore | undefined {
  const client = redisConnection;
  if (!client) return undefined;

  return new RedisStore({
    sendCommand: (...args: string[]) => client.call(args[0], ...args.slice(1)) as Promise<number>,
    prefix
  });
}

