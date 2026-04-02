import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
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
