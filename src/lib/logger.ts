import winston from "winston";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = new Set([
  "accessToken",
  "apiKey",
  "authorization",
  "cookie",
  "email",
  "password",
  "refreshToken",
  "secret",
  "token"
]);

function shouldRedactKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (SENSITIVE_KEYS.has(key)) return true;
  return (
    normalized.includes("token") ||
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("cookie") ||
    normalized.includes("authorization") ||
    normalized.includes("email")
  );
}

function redactString(value: string): string {
  if (value.startsWith("Bearer ")) return `Bearer ${REDACTED}`;
  return value;
}

export function redactSensitiveData<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value) as T;
  if (typeof value !== "object") return value;
  if (value instanceof Date || value instanceof RegExp || Buffer.isBuffer(value) || value instanceof Error) {
    return value;
  }
  if (seen.has(value as object)) {
    return "[Circular]" as T;
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, seen)) as T;
  }

  const cloned: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    cloned[key] = shouldRedactKey(key) ? REDACTED : redactSensitiveData(entry, seen);
  }
  return cloned as T;
}

const piiMaskFormat = winston.format((info) => Object.assign(info, redactSensitiveData(info)));

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    piiMaskFormat(),
    winston.format.json()
  ),
  defaultMeta: { service: "social-media-controller" },
  transports: [new winston.transports.Console()]
});

/** Structured gauge-style log for log drains (Datadog, etc.) — search `metricName`. */
export function logMetric(
  metricName: string,
  value: number,
  meta?: Record<string, unknown>
): void {
  logger.info("metric", {
    metricName,
    value,
    pid: process.pid,
    ...meta
  });
}
