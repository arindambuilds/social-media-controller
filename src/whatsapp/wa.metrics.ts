import { logger } from "../lib/logger";
import { redisConnection } from "../lib/redis";

const DLQ_INGRESS_KEY = "pulse:wa:dlq:ingress:5m";
const DLQ_OUTBOUND_KEY = "pulse:wa:dlq:outbound:5m";

export const WA_METRIC_KEYS = {
  ingressProcessed: "pulse:wa:metrics:ingress_processed",
  ingressDlq: "pulse:wa:metrics:ingress_dlq",
  outboundDlq: "pulse:wa:metrics:outbound_dlq",
  outboundSent: "pulse:wa:metrics:outbound_sent",
  outboundFailed: "pulse:wa:metrics:outbound_failed",
  violation24h: "pulse:wa:metrics:24h_violation"
} as const;

function bumpMetricKey(key: string): void {
  if (!redisConnection) return;
  void redisConnection.incr(key).catch(() => {
    /* best-effort */
  });
}

/** Rolling ~5m window: INCR + EXPIRE 300 (TTL extends from last DLQ). */
export async function incrementWaDlqRolling(channel: "ingress" | "outbound"): Promise<void> {
  if (!redisConnection) return;
  const k = channel === "ingress" ? DLQ_INGRESS_KEY : DLQ_OUTBOUND_KEY;
  try {
    const pipe = redisConnection.multi();
    pipe.incr(k);
    pipe.expire(k, 300);
    await pipe.exec();
  } catch {
    /* best-effort */
  }
}

export async function getWaDlqCountLast5Min(channel: "ingress" | "outbound"): Promise<number> {
  if (!redisConnection) return 0;
  const k = channel === "ingress" ? DLQ_INGRESS_KEY : DLQ_OUTBOUND_KEY;
  try {
    const raw = await redisConnection.get(k);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function recordWhatsAppIngressProcessed(waId: string): void {
  const timestamp = new Date().toISOString();
  logger.info("wa.metric", { event: "whatsapp_ingress_processed", waId, timestamp });
  bumpMetricKey(WA_METRIC_KEYS.ingressProcessed);
}

export function recordWhatsAppIngressDispatch(kind: string): void {
  logMetricCompat("whatsapp_ingress_dispatch", 1, { kind });
}

export function recordWhatsAppIngressRateLimited(): void {
  logMetricCompat("whatsapp_ingress_rate_limited", 1, {});
}

export function recordWhatsAppInbound(): void {
  logMetricCompat("whatsapp_ingress_inbound", 1, {});
}

export function recordWhatsAppDuplicateSkipped(): void {
  logMetricCompat("whatsapp_ingress_duplicate_skipped", 1, {});
}

export async function recordWhatsAppIngressDlq(waId: string, reason: string): Promise<void> {
  const timestamp = new Date().toISOString();
  logger.warn("wa.metric", { event: "whatsapp_ingress_dlq", waId, timestamp, reason });
  bumpMetricKey(WA_METRIC_KEYS.ingressDlq);
  await incrementWaDlqRolling("ingress");
}

export async function recordWhatsAppOutboundDlq(waId: string, reason: string): Promise<void> {
  const timestamp = new Date().toISOString();
  logger.warn("wa.metric", { event: "whatsapp_outbound_dlq", waId, timestamp, reason });
  bumpMetricKey(WA_METRIC_KEYS.outboundDlq);
  await incrementWaDlqRolling("outbound");
}

export function recordWhatsAppOutboundSent(waId: string): void {
  const timestamp = new Date().toISOString();
  logger.info("wa.metric", { event: "whatsapp_outbound_sent", waId, timestamp });
  bumpMetricKey(WA_METRIC_KEYS.outboundSent);
}

export function recordWhatsAppOutboundFailed(waId: string, errorCode?: number): void {
  const timestamp = new Date().toISOString();
  logger.warn("wa.metric", {
    event: "whatsapp_outbound_failed",
    waId,
    timestamp,
    ...(errorCode !== undefined ? { errorCode } : {})
  });
  bumpMetricKey(WA_METRIC_KEYS.outboundFailed);
}

export function recordWhatsApp24hViolation(waId: string): void {
  const timestamp = new Date().toISOString();
  logger.warn("wa.metric", { event: "whatsapp_24h_violation", waId, timestamp });
  bumpMetricKey(WA_METRIC_KEYS.violation24h);
}

/** @deprecated Use {@link recordWhatsApp24hViolation}. */
export function recordWhatsApp24hBlock(): void {
  recordWhatsApp24hViolation("unknown");
}

function logMetricCompat(metricName: string, value: number, meta?: Record<string, unknown>): void {
  logger.info("metric", {
    metricName,
    value,
    pid: process.pid,
    ...meta
  });
}
