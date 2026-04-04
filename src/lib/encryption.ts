import crypto from "crypto";
import { env } from "../config/env";

function resolvePrimaryKeySource(): string {
  return env.ENCRYPTION_KEY && env.ENCRYPTION_KEY.length >= 32
    ? env.ENCRYPTION_KEY
    : env.JWT_SECRET;
}

function resolveFallbackKeySource(primaryKeySource: string): string | undefined {
  const fallback = env.ENCRYPTION_KEY_PREV?.trim();
  if (!fallback || fallback.length < 32 || fallback === primaryKeySource) return undefined;
  return fallback;
}

function deriveKey(keySource: string): Buffer {
  return crypto.createHash("sha256").update(keySource).digest();
}

export function encryptWithKeySource(plainText: string, keySource: string): string {
  const key = deriveKey(keySource);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

function decryptWithKey(payload: string, key: Buffer): string {
  const [ivHex, authTagHex, encryptedHex] = payload.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted payload.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

export function decryptWithKeySources(payload: string, keySources: readonly string[]): string {
  let firstError: Error | undefined;

  for (const keySource of keySources) {
    if (!keySource || keySource.length < 32) continue;
    try {
      return decryptWithKey(payload, deriveKey(keySource));
    } catch (err) {
      if (!firstError) {
        firstError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  throw firstError ?? new Error("No valid encryption key sources are configured.");
}

export function encrypt(plainText: string): string {
  return encryptWithKeySource(plainText, resolvePrimaryKeySource());
}

export function decrypt(payload: string): string {
  const primaryKeySource = resolvePrimaryKeySource();
  const fallbackKeySource = resolveFallbackKeySource(primaryKeySource);
  const keySources = fallbackKeySource
    ? [primaryKeySource, fallbackKeySource]
    : [primaryKeySource];
  return decryptWithKeySources(payload, keySources);
}
