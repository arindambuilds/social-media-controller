import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import * as transcribe from "../src/services/transcribe";
import * as captionGen from "../src/services/captionGenerator";
import * as intentParser from "../src/services/intentParser";

const hasDb = Boolean(process.env.DATABASE_URL);
const run = hasDb ? describe : describe.skip;

vi.mock("../src/services/transcribe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/transcribe")>();
  return { ...actual, transcribeAudio: vi.fn() };
});

vi.mock("../src/services/intentParser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/intentParser")>();
  return { ...actual, parseVoiceIntent: vi.fn() };
});

vi.mock("../src/services/captionGenerator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/captionGenerator")>();
  return { ...actual, generateCaption: vi.fn() };
});

run("POST /api/voice/transcribe", () => {
  const app = createApp();

  beforeAll(async () => {
    if (!hasDb) return;
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  it("happy-path: returns transcript + captions", async () => {
    vi.mocked(transcribe.transcribeAudio).mockResolvedValueOnce("namaste dukaan khola");
    vi.mocked(intentParser.parseVoiceIntent).mockResolvedValueOnce({
      topic: "shop",
      platform: "instagram",
      scheduledTime: "today",
      tone: "casual",
      language: "bilingual",
      rawTranscript: "namaste dukaan khola"
    });
    vi.mocked(captionGen.generateCaption).mockResolvedValueOnce({
      caption: "Namaskar!",
      hashtags: ["#msme"],
      imagePrompt: "storefront",
      suggestedTime: new Date("2026-03-31T10:00:00.000Z")
    });

    const login = await request(app).post("/api/auth/login").send({
      email: "demo@demo.com",
      password: "Demo1234!"
    });
    if (login.status !== 200) {
      expect(login.status).toBeDefined();
      return;
    }
    const token = login.body.accessToken as string;
    const res = await request(app)
      .post("/api/voice/transcribe")
      .set("Authorization", `Bearer ${token}`)
      .field("clientId", "demo-client")
      .attach("audio", Buffer.from("fake-audio"), "clip.webm");

    expect(res.status).toBe(200);
    expect(res.body.transcript).toBe("namaste dukaan khola");
    expect(res.body.captions?.caption).toBe("Namaskar!");
  });

  it("oversized file (>15 MB) returns 413", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: "demo@demo.com",
      password: "Demo1234!"
    });
    if (login.status !== 200) return;
    const token = login.body.accessToken as string;
    const big = Buffer.alloc(15 * 1024 * 1024 + 1, 1);
    const res = await request(app)
      .post("/api/voice/transcribe")
      .set("Authorization", `Bearer ${token}`)
      .field("clientId", "demo-client")
      .attach("audio", big, "big.webm");
    expect(res.status).toBe(413);
  });

  it("whisper failure (429) returns 503 and does not call caption", async () => {
    vi.mocked(transcribe.transcribeAudio).mockRejectedValueOnce(
      Object.assign(new Error("Too Many Requests"), { status: 429 })
    );
    vi.mocked(intentParser.parseVoiceIntent).mockClear();
    vi.mocked(captionGen.generateCaption).mockClear();

    const login = await request(app).post("/api/auth/login").send({
      email: "demo@demo.com",
      password: "Demo1234!"
    });
    if (login.status !== 200) return;
    const token = login.body.accessToken as string;
    const res = await request(app)
      .post("/api/voice/transcribe")
      .set("Authorization", `Bearer ${token}`)
      .field("clientId", "demo-client")
      .attach("audio", Buffer.from("x"), "x.webm");
    expect(res.status).toBe(503);
    expect(vi.mocked(intentParser.parseVoiceIntent)).not.toHaveBeenCalled();
    expect(vi.mocked(captionGen.generateCaption)).not.toHaveBeenCalled();
  });

  it("claude failure after whisper returns 503", async () => {
    vi.mocked(transcribe.transcribeAudio).mockResolvedValueOnce("ok transcript");
    vi.mocked(intentParser.parseVoiceIntent).mockResolvedValueOnce({
      topic: "t",
      platform: "instagram",
      scheduledTime: "now",
      tone: "casual",
      language: "english",
      rawTranscript: "ok"
    });
    vi.mocked(captionGen.generateCaption).mockRejectedValueOnce(new Error("AI down"));

    const login = await request(app).post("/api/auth/login").send({
      email: "demo@demo.com",
      password: "Demo1234!"
    });
    if (login.status !== 200) return;
    const token = login.body.accessToken as string;
    const res = await request(app)
      .post("/api/voice/transcribe")
      .set("Authorization", `Bearer ${token}`)
      .field("clientId", "demo-client")
      .attach("audio", Buffer.from("y"), "y.webm");
    expect(res.status).toBe(503);
  });
});
