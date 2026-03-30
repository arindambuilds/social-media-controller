import { UnrecoverableError } from "bullmq";

/**
 * BullMQ retries exponential backoff on the job — burn retries only for **transient** faults.
 * Throw {@link UnrecoverableError} so the worker does not re-run after validation / missing data / config.
 * Rate limits (429 / Retry-After) are **not** listed here — those errors should keep retrying with jittered backoff.
 */
const UNRECOVERABLE_MESSAGE =
  /Client not found|Voice transcription is not configured|ZodError|\bP2025\b|\bP2003\b|empty transcript|PDF worker returned an invalid|Record to find does not exist|not found for this user|Forbidden for this client|briefing job missing clientId|Invalid `prisma\./i;

export function toBullMqProcessorError(err: unknown): Error {
  if (err instanceof UnrecoverableError) return err;
  const e = err instanceof Error ? err : new Error(String(err));
  if (UNRECOVERABLE_MESSAGE.test(e.message)) {
    return new UnrecoverableError(e.message);
  }
  return e;
}
