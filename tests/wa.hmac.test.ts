import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { whatsappHmacPreParseMiddleware } from "../src/whatsapp/hmac.middleware";

vi.mock("../src/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

function hmacHeader(body: Buffer, secret: string): string {
  const hex = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${hex}`;
}

function makeReq(body: Buffer, signatureHeader: string | undefined): Request {
  return {
    body,
    get: (name: string) => {
      if (name.toLowerCase() === "x-hub-signature-256") {
        return signatureHeader;
      }
      return undefined;
    }
  } as unknown as Request;
}

describe("wa.hmac", () => {
  const secret = "wa-app-secret-min-32-characters-xx";

  beforeEach(() => {
    vi.stubEnv("WA_APP_SECRET", secret);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("valid signature → calls next()", () => {
    const body = Buffer.from(JSON.stringify({ ok: true }), "utf8");
    const next = vi.fn() as unknown as NextFunction;
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status, json, locals: {} } as unknown as Response;
    const mw = whatsappHmacPreParseMiddleware(() => process.env.WA_APP_SECRET ?? "");
    mw(makeReq(body, hmacHeader(body, secret)), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it("missing x-hub-signature-256 → 403", () => {
    const body = Buffer.from("{}", "utf8");
    const next = vi.fn() as unknown as NextFunction;
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status, json, locals: {} } as unknown as Response;
    const mw = whatsappHmacPreParseMiddleware(() => process.env.WA_APP_SECRET ?? "");
    mw(makeReq(body, undefined), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalled();
  });

  it("wrong signature → 403", () => {
    const body = Buffer.from("{}", "utf8");
    const next = vi.fn() as unknown as NextFunction;
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status, json, locals: {} } as unknown as Response;
    const mw = whatsappHmacPreParseMiddleware(() => process.env.WA_APP_SECRET ?? "");
    mw(makeReq(body, hmacHeader(body, "wrong-secret-wrong-secret-wrong!!")), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it("tampered body → 403", () => {
    const signed = Buffer.from('{"a":1}', "utf8");
    const tampered = Buffer.from('{"a":2}', "utf8");
    const next = vi.fn() as unknown as NextFunction;
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status, json, locals: {} } as unknown as Response;
    const mw = whatsappHmacPreParseMiddleware(() => process.env.WA_APP_SECRET ?? "");
    mw(makeReq(tampered, hmacHeader(signed, secret)), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });
});
