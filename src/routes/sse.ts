import type { Express, Request, Response } from "express";
import Redis from "ioredis";
import { verifyAccessToken } from "../auth/jwt";
import { env } from "../config/env";
import { ACCESS_COOKIE } from "../lib/authCookies";
import { logger } from "../lib/logger";
import { redisConnection } from "../lib/redis";
import { prisma } from "../lib/prisma";

function resolveSseAuth(req: Request): { userId: string; role: string; clientId?: string } | null {
  let token: string | undefined;
  const q = req.query.access_token;
  if (typeof q === "string" && q.trim()) token = q.trim();
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (!token && env.AUTH_HTTPONLY_COOKIES) {
    const c = req.cookies?.[ACCESS_COOKIE];
    if (typeof c === "string" && c.length > 0) token = c;
  }
  if (!token) return null;
  try {
    const p = verifyAccessToken(token);
    return { userId: p.sub, role: p.role, clientId: p.clientId };
  } catch {
    return null;
  }
}

async function agencyCanTouchClient(userId: string, clientId: string): Promise<boolean> {
  const row = await prisma.client.findFirst({
    where: { id: clientId, OR: [{ agencyId: userId }, { ownerId: userId }] },
    select: { id: true }
  });
  return !!row;
}

/**
 * Authenticated SSE stream: `pulse:{clientId}` Redis channel.
 * Query: `access_token` (JWT) when EventSource cannot send Authorization header; optional `clientId` for agency.
 */
export function attachSseRoute(app: Express): void {
  app.get("/api/events", async (req, res) => {
    const auth = resolveSseAuth(req);
    if (!auth) {
      res.status(401).json({ success: false, error: { message: "Please log in again." } });
      return;
    }

    let clientId: string | undefined;
    if (auth.role === "CLIENT_USER") {
      clientId = auth.clientId;
      if (!clientId) {
        res.status(400).json({ success: false, error: { message: "No client assigned." } });
        return;
      }
    } else {
      const raw = req.query.clientId;
      const cid = typeof raw === "string" ? raw.trim() : "";
      if (!cid) {
        res.status(400).json({ success: false, error: { message: "Query clientId is required." } });
        return;
      }
      const ok = await agencyCanTouchClient(auth.userId, cid);
      if (!ok) {
        res.status(403).json({ success: false, error: { message: "You do not have access to this." } });
        return;
      }
      clientId = cid;
    }

    if (!redisConnection) {
      res.status(503).json({
        success: false,
        error: {
          code: "SSE_UNAVAILABLE",
          message: "Live updates require Redis. Use polling until REDIS_URL is configured."
        }
      });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === "function") {
      (res as Response & { flushHeaders: () => void }).flushHeaders();
    }

    const channel = `pulse:${clientId}`;
    let sub: Redis | null = null;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const send = (event: string, data: string, id?: string) => {
      if (id) res.write(`id: ${id}\n`);
      res.write(`event: ${event}\n`);
      res.write(`data: ${data}\n\n`);
    };

    try {
      sub = redisConnection.duplicate();
      await sub.subscribe(channel);

      send(
        "connected",
        JSON.stringify({ type: "connected", clientId, ts: Date.now() }),
        `conn-${Date.now()}`
      );

      sub.on("message", (_ch, message) => {
        try {
          const parsed = JSON.parse(message) as { eventId?: string };
          const id = typeof parsed.eventId === "string" ? parsed.eventId : undefined;
          send("pulse", message, id);
        } catch {
          send("pulse", message);
        }
      });

      heartbeat = setInterval(() => {
        res.write(`: ping ${Date.now()}\n\n`);
      }, 25_000);

      req.on("close", () => {
        if (heartbeat) clearInterval(heartbeat);
        if (sub) {
          void sub.unsubscribe(channel).catch(() => {});
          void sub.quit().catch(() => {});
        }
      });
    } catch (err) {
      logger.warn("SSE subscribe failed", {
        message: err instanceof Error ? err.message : String(err)
      });
      if (heartbeat) clearInterval(heartbeat);
      if (sub) void sub.quit().catch(() => {});
      send("error", JSON.stringify({ type: "error", message: "Could not subscribe to live channel." }));
      res.end();
    }
  });
}
