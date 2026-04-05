export type ConversionEvent = {
  userId: string
  event: string
  metadata?: Record<string, unknown>
  timestamp?: string
}

/**
 * TODO: replace with Postgres via backend API when analytics
 * reporting is built. Local filesystem is not safe on Vercel.
 */
export function recordConversion(_event: ConversionEvent): void {
  // no-op on serverless — safe to call, writes nothing
}

export function readConversions(_userId?: string): ConversionEvent[] {
  // no-op on serverless — returns empty
  return []
}

