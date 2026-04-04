import { redisConnection } from "../../lib/redis";

function getRedis() {
  if (!redisConnection) {
    throw new Error("Email rate limiting requires Redis.");
  }
  return redisConnection;
}

export class EmailRateLimiter {
  constructor(
    private readonly perHour: number,
    private readonly perDay: number,
    private readonly windowHourMs: number = 3_600_000,
    private readonly windowDayMs: number = 86_400_000
  ) {}

  async canSend(recipient: string): Promise<{ allowed: boolean; retryAfterMs?: number }> {
    const now = Date.now();
    const hourWindowStart = now - this.windowHourMs;
    const dayWindowStart = now - this.windowDayMs;
    const redis = getRedis();

    const hourKey = `email:rate:hour:${recipient.toLowerCase()}`;
    const dayKey = `email:rate:day:${recipient.toLowerCase()}`;

    const [hourResult, dayResult] = await Promise.all([
      this.checkWindow(redis, hourKey, hourWindowStart, now, this.perHour, this.windowHourMs),
      this.checkWindow(redis, dayKey, dayWindowStart, now, this.perDay, this.windowDayMs)
    ]);

    if (!hourResult.allowed) return hourResult;
    if (!dayResult.allowed) return dayResult;
    return { allowed: true };
  }

  private async checkWindow(
    redis: NonNullable<typeof redisConnection>,
    key: string,
    windowStart: number,
    now: number,
    limit: number,
    ttlMs: number
  ): Promise<{ allowed: boolean; retryAfterMs?: number }> {
    await redis.zremrangebyscore(key, 0, windowStart);
    const count = await redis.zcard(key);
    if (count >= limit) {
      const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
      const oldestScore = oldest.length >= 2 ? Number(oldest[1]) : now;
      return { allowed: false, retryAfterMs: Math.max(1, oldestScore + ttlMs - now) };
    }

    const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
    await redis.zadd(key, now, member);
    await redis.pexpire(key, ttlMs);
    return { allowed: true };
  }
}
