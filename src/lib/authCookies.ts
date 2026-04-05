import type { CookieOptions, Response } from "express";
import { env } from "../config/env";

export const ACCESS_COOKIE = "smc_access";
export const REFRESH_COOKIE = "smc_refresh";
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseDurationToMs(value: string): number {
  const s = value.trim();
  const m = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(s);
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  const mult =
    u === "ms" ? 1 : u === "s" ? 1000 : u === "m" ? 60_000 : u === "h" ? 3_600_000 : 86_400_000;
  return n * mult;
}

function cookieBase(): Pick<CookieOptions, "httpOnly" | "secure" | "sameSite" | "path"> {
  const prod = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? "none" : "lax",
    path: "/"
  };
}

export function setAuthCookieHeaders(res: Response, accessToken: string, refreshToken: string): void {
  const base = cookieBase();
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base,
    maxAge: parseDurationToMs(env.JWT_EXPIRES_IN)
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS
  });
}

export function clearAuthCookieHeaders(res: Response): void {
  const base = cookieBase();
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}
