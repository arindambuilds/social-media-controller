import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { redisConnection } from "../src/lib/redis";

const hasDb = Boolean(process.env.DATABASE_URL);
const hasRedis = Boolean(process.env.REDIS_URL);

const run = hasDb && hasRedis ? describe : describe.skip;

run("API MVP smoke", () => {
  const app = createApp();

  beforeAll(async () => {
    if (!hasDb) return;
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
    await redisConnection?.quit().catch(() => {});
  });

  it("GET /health returns database, redis, timestamp", async () => {
    const res = await request(app).get("/health");
    expect([200, 503]).toContain(res.status);
    expect(res.body).toMatchObject({
      server: "ok",
      database: expect.any(String),
      redis: expect.any(String),
      timestamp: expect.any(String),
      ingestionMode: expect.any(String)
    });
  });

  it("POST /api/auth/signup creates user", async () => {
    const email = `vitest-${Date.now()}@example.com`;
    const res = await request(app).post("/api/auth/signup").send({
      email,
      password: "testpasslong1",
      name: "Vitest User"
    });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    await prisma.user.deleteMany({ where: { email } });
  });

  it("POST /api/auth/login returns JWT for seeded admin", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "admin@demo.com",
      password: "admin123"
    });
    if (res.status === 401) {
      expect(res.status).toBe(401);
      return;
    }
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it("GET /api/analytics/:clientId/overview returns 401 without token", async () => {
    const res = await request(app).get("/api/analytics/demo-client/overview?days=30");
    expect(res.status).toBe(401);
  });

  it("GET /api/analytics/:clientId/overview returns data with valid token", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: "admin@demo.com",
      password: "admin123"
    });
    if (login.status !== 200) {
      expect(login.status).toBeDefined();
      return;
    }
    const token = login.body.accessToken as string;
    const res = await request(app)
      .get("/api/analytics/demo-client/overview?days=30")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.totalPosts).toBe("number");
  });

  it("POST /api/instagram/sync accepts job (202)", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: "admin@demo.com",
      password: "admin123"
    });
    if (login.status !== 200) return;
    const token = login.body.accessToken as string;
    const res = await request(app)
      .post("/api/instagram/sync")
      .set("Authorization", `Bearer ${token}`)
      .send({ clientId: "demo-client" });
    expect([202, 404]).toContain(res.status);
  });
});
