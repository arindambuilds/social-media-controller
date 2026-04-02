import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import type { PulseNormalisedWhatsAppMessage } from "../types/pulse-message.types";
import { patchRedisTurnMediaUrl } from "./session.store";
import type Redis from "ioredis";

const GRAPH_API_VERSION = "v21.0";
/** WhatsApp Cloud media download cap (Meta payloads should stay smaller; guard against abuse). */
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

function resolveAccessToken(): string {
  return (
    env.WA_GRAPH_ACCESS_TOKEN ||
    env.WA_ACCESS_TOKEN?.trim() ||
    process.env.WA_TOKEN?.trim() ||
    process.env.WHATSAPP_CLOUD_API_TOKEN?.trim() ||
    process.env.META_WHATSAPP_TOKEN?.trim() ||
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() ||
    ""
  );
}

function resolveBucket(): string {
  return process.env.SUPABASE_WHATSAPP_MEDIA_BUCKET?.trim() || "whatsapp-media";
}

async function fetchMediaMetadata(
  mediaId: string,
  token: string
): Promise<{ url: string; mimeType?: string } | null> {
  const u = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(mediaId)}`);
  u.searchParams.set("fields", "url,mime_type");
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(25_000)
  });
  if (!res.ok) {
    return null;
  }
  const json = (await res.json()) as Record<string, unknown>;
  const url = json.url;
  if (typeof url !== "string" || !url.length) {
    return null;
  }
  const mimeType = typeof json.mime_type === "string" ? json.mime_type : undefined;
  return { url, mimeType };
}

async function downloadBinary(graphUrl: string, token: string): Promise<Buffer | null> {
  const res = await fetch(graphUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60_000)
  });
  if (!res.ok) {
    return null;
  }
  const lenHdr = res.headers.get("content-length");
  if (lenHdr) {
    const n = Number.parseInt(lenHdr, 10);
    if (Number.isFinite(n) && n > MAX_MEDIA_BYTES) {
      logger.warn("whatsapp media: download rejected (Content-Length over cap)", {
        contentLength: n,
        max: MAX_MEDIA_BYTES
      });
      return null;
    }
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_MEDIA_BYTES) {
    logger.warn("whatsapp media: download rejected (body over cap)", {
      size: buf.length,
      max: MAX_MEDIA_BYTES
    });
    return null;
  }
  return buf;
}

/**
 * Downloads WhatsApp media from Graph, uploads to Supabase Storage, patches Redis session turns.
 * Never throws to callers — errors are logged.
 */
export function scheduleWhatsAppMediaIngest(redis: Redis | null, message: PulseNormalisedWhatsAppMessage): void {
  if (message.payload.kind === "text" || message.payload.kind === "unknown") {
    return;
  }
  const mediaPayload = message.payload;
  const mediaId = mediaPayload.mediaId;
  const token = resolveAccessToken();
  if (!token.length) {
    logger.warn("whatsapp media: missing WA_ACCESS_TOKEN / WHATSAPP_CLOUD_API_TOKEN / META_WHATSAPP_TOKEN", {
      messageId: message.messageId
    });
    return;
  }

  void (async () => {
    try {
      const meta = await fetchMediaMetadata(mediaId, token);
      if (!meta) {
        logger.warn("whatsapp media: metadata fetch failed", { mediaId });
        return;
      }
      const binary = await downloadBinary(meta.url, token);
      if (!binary) {
        logger.warn("whatsapp media: binary download failed", { mediaId });
        return;
      }

      const url = process.env.SUPABASE_URL?.trim();
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (!url || !key) {
        logger.warn("whatsapp media: Supabase env missing — skipping storage upload", { mediaId });
        return;
      }

      const sb = createClient(url, key, { auth: { persistSession: false } });
      const bucket = resolveBucket();
      const objectPath = `${message.phoneNumberId}/${message.waId}/${message.messageId}`;
      const contentType = mediaPayload.mimeType ?? meta.mimeType ?? "application/octet-stream";

      const { data, error } = await sb.storage.from(bucket).upload(objectPath, binary, {
        contentType,
        upsert: true
      });

      if (error) {
        logger.warn("whatsapp media: storage upload failed", {
          message: error.message,
          mediaId
        });
        return;
      }

      const path = data?.path ?? objectPath;
      const { data: pub } = sb.storage.from(bucket).getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      await patchRedisTurnMediaUrl(redis, message.sessionId, message.messageId, publicUrl);
    } catch (err) {
      logger.warn("whatsapp media: async ingest failed", {
        message: err instanceof Error ? err.message : String(err),
        mediaId
      });
    }
  })();
}
