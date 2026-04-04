import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { decryptWithKeySources, encryptWithKeySource } from "../src/lib/encryption";
import { redactSensitiveData } from "../src/lib/logger";
import { isSafeUrl, sanitizeLogoUrl, validateLogoUrlInput } from "../src/lib/urlUtils";

describe("Security hardening verification", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
  });

  it("returns 401 for unauthenticated /api/execute requests", async () => {
    const res = await request(app).post("/api/execute").send({ input: "test" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" }
    });
  });

  it("returns 401 for unauthenticated /api/message requests", async () => {
    const res = await request(app).post("/api/message").send({ message: "test" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" }
    });
  });

  it("rejects unsafe logo URLs and preserves safe upload paths", () => {
    expect(isSafeUrl("/uploads/logos/demo.png")).toBe(true);
    expect(isSafeUrl("https://cdn.example.com/logo.png")).toBe(true);
    expect(isSafeUrl("http://localhost:3000/logo.png")).toBe(false);
    expect(isSafeUrl("https://127.0.0.1/logo.png")).toBe(false);
    expect(isSafeUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isSafeUrl("https://192.168.1.20/logo.png")).toBe(false);

    expect(validateLogoUrlInput("https://cdn.example.com/logo.png")).toEqual({
      valid: true,
      normalized: "https://cdn.example.com/logo.png"
    });
    expect(validateLogoUrlInput("/uploads/logos/demo.png")).toEqual({
      valid: true,
      normalized: "/uploads/logos/demo.png"
    });
    expect(validateLogoUrlInput("https://localhost/logo.png")).toMatchObject({
      valid: false
    });
    expect(sanitizeLogoUrl("https://localhost/logo.png")).toBeNull();
  });

  it("decrypts with a fallback key when the primary key no longer matches", () => {
    const previousKey = "previous-key-material-1234567890!!";
    const currentKey = "current-key-material-abcdef123456!!";
    const payload = encryptWithKeySource("sensitive-token", previousKey);

    expect(() => decryptWithKeySources(payload, [currentKey])).toThrow();
    expect(decryptWithKeySources(payload, [currentKey, previousKey])).toBe("sensitive-token");
  });

  it("redacts sensitive values before structured logs are emitted", () => {
    const payload = redactSensitiveData({
      message: "login failed",
      email: "owner@example.com",
      accessToken: "abc123",
      nested: {
        refreshToken: "refresh-123",
        authorization: "Bearer secret-value",
        ok: true
      },
      events: [
        {
          password: "super-secret",
          status: "failed"
        }
      ]
    });

    expect(payload).toEqual({
      message: "login failed",
      email: "[REDACTED]",
      accessToken: "[REDACTED]",
      nested: {
        refreshToken: "[REDACTED]",
        authorization: "[REDACTED]",
        ok: true
      },
      events: [
        {
          password: "[REDACTED]",
          status: "failed"
        }
      ]
    });
  });
});
