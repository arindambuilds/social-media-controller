import crypto from "crypto";
import { env } from "../config/env";

/** Prefer dedicated ENCRYPTION_KEY (32+ chars); otherwise derive from JWT_SECRET (also min 32). */
const keySource =
  env.ENCRYPTION_KEY && env.ENCRYPTION_KEY.length >= 32
    ? env.ENCRYPTION_KEY
    : env.JWT_SECRET;

const key = crypto.createHash("sha256").update(keySource).digest();

export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decrypt(payload: string): string {
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
