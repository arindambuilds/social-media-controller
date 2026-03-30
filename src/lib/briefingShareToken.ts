import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { env } from "../config/env";

const TTL_MS = 24 * 3600_000;

function signingKey(): string {
  return `${env.JWT_SECRET}:briefing-share`;
}

export type BriefingSharePayload = {
  briefingId: string;
  exp: number;
  nonce: string;
};

export function signBriefingShareToken(briefingId: string): { token: string; expiresAt: Date } {
  const exp = Date.now() + TTL_MS;
  const nonce = randomBytes(8).toString("hex");
  const payload: BriefingSharePayload = { briefingId, exp, nonce };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", signingKey()).update(payloadB64).digest("base64url");
  return { token: `${payloadB64}.${sig}`, expiresAt: new Date(exp) };
}

export function verifyBriefingShareToken(token: string): BriefingSharePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;
  const expected = createHmac("sha256", signingKey()).update(payloadB64).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let parsed: BriefingSharePayload;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as BriefingSharePayload;
  } catch {
    return null;
  }
  if (typeof parsed.briefingId !== "string" || typeof parsed.exp !== "number") return null;
  if (parsed.exp < Date.now()) return null;
  return parsed;
}
