import { randomUUID } from "crypto";
import { redisConnection } from "./redis";
import { logger } from "./logger";

export type PulseEventEnvelope = {
  eventId: string;
  type: string;
  clientId: string;
  ts: number;
  data?: Record<string, unknown>;
};

const CHANNEL = (clientId: string) => `pulse:${clientId}`;

export async function publishPulseEvent(
  clientId: string,
  type: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!redisConnection) return;
  try {
    const envelope: PulseEventEnvelope = {
      eventId: randomUUID(),
      type,
      clientId,
      ts: Date.now(),
      data
    };
    await redisConnection.publish(CHANNEL(clientId), JSON.stringify(envelope));
  } catch (err) {
    logger.warn("publishPulseEvent failed", {
      clientId,
      type,
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
