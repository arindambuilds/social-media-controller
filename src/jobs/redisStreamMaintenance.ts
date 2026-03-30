import { logger, logMetric } from "../lib/logger";
import { flushPdfQueueMetrics } from "../lib/pdfQueueMetricsFlush";
import { redisConnection } from "../lib/redis";

/** Same stream as dashboard `dashboard/lib/server/analyticsRedis.ts` (dual-write events). */
const ANALYTICS_EVENTS_STREAM = "pulse:analytics:events";

const INTERVAL_MS = 5 * 60 * 1000;
/** Soft ceiling — XADD may use a lower MAXLEN; this re-trims if replicas drift. */
const STREAM_MAXLEN = 100_000;
/** Investigate when RSS crosses this (bytes) — tune per host (e.g. 2.5GB on 8GB dyno). */
const REDIS_MEMORY_WARN_BYTES = Math.floor(2.5 * 1024 * 1024 * 1024);

/**
 * Periodic XTRIM + memory sampling so analytics streams do not grow unbounded on Redis.
 * Runs in API process when `REDIS_URL` is configured.
 */
export function startRedisStreamMaintenance(): void {
  if (!redisConnection) return;

  const run = (): void => {
    void (async () => {
      try {
        await redisConnection!.xtrim(ANALYTICS_EVENTS_STREAM, "MAXLEN", "~", STREAM_MAXLEN);
      } catch (e) {
        logger.warn("redis_stream_xtrim_skipped", {
          message: e instanceof Error ? e.message : String(e),
          stream: ANALYTICS_EVENTS_STREAM
        });
      }

      try {
        const streamLen = await redisConnection!.xlen(ANALYTICS_EVENTS_STREAM);
        logMetric("redis_stream_analytics_events_len", streamLen, { stream: ANALYTICS_EVENTS_STREAM });
      } catch (e) {
        logger.warn("redis_stream_xlen_failed", {
          message: e instanceof Error ? e.message : String(e),
          stream: ANALYTICS_EVENTS_STREAM
        });
      }

      try {
        const info = await redisConnection!.info("memory");
        const m = /used_memory:(\d+)/.exec(info);
        const used = m ? parseInt(m[1], 10) : 0;
        logMetric("redis_memory_used_bytes", used);
        const fragM = /mem_fragmentation_ratio:([\d.]+)/.exec(info);
        if (fragM) {
          const frag = parseFloat(fragM[1]);
          if (!Number.isNaN(frag)) {
            logMetric("redis_mem_fragmentation_ratio", Math.round(frag * 1000) / 1000);
          }
        }
        if (used > REDIS_MEMORY_WARN_BYTES) {
          logger.warn("redis_memory_high", { usedBytes: used, warnThresholdBytes: REDIS_MEMORY_WARN_BYTES });
        }
      } catch (e) {
        logger.warn("redis_memory_info_failed", {
          message: e instanceof Error ? e.message : String(e)
        });
      }

      await flushPdfQueueMetrics();
    })();
  };

  run();
  setInterval(run, INTERVAL_MS);
}
