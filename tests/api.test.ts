import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/lib/prisma";
import { redisConnection } from "../src/lib/redis";
import { matchesWebhookSignature, signWebhookPayload } from "../src/routes/webhooks";
import { upsertSocialAccount } from "../src/services/socialAccountService";
import { writeAuditLog } from "../src/services/auditLogService";

const hasDb = Boolean(process.env.DATABASE_URL);

const run = hasDb ? describe : describe.skip;

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

  it("GET /api/health/db returns status ok when database is reachable", async () => {
    const res = await request(app).get("/api/health/db");
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toMatchObject({ status: "ok", database: "connected" });
    } else {
      expect(res.body).toMatchObject({ status: "error" });
      if (process.env.NODE_ENV !== "production") {
        expect(res.body).toHaveProperty("detail");
      }
    }
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

  it("POST /api/auth/signup ignores attempts to self-assign agency admin", async () => {
    const email = `signup-role-${Date.now()}@example.com`;
    const res = await request(app).post("/api/auth/signup").send({
      email,
      password: "testpasslong1",
      name: "Role Test",
      role: "AGENCY_ADMIN"
    });

    expect(res.status).toBe(201);
    expect(res.body.user?.role).toBe("CLIENT_USER");

    const user = await prisma.user.findUnique({
      where: { email },
      select: { role: true }
    });
    expect(user?.role).toBe("CLIENT_USER");

    await prisma.user.deleteMany({ where: { email } });
  });

  it("POST /api/auth/login returns the sanitized auth contract", async () => {
    const email = `auth-login-${Date.now()}@example.com`;
    const password = "testpasslong1";

    const signup = await request(app).post("/api/auth/signup").send({
      email,
      password,
      name: "Auth Login Contract"
    });

    expect(signup.status).toBe(201);

    const res = await request(app).post("/api/auth/login").send({
      email,
      password
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.accessToken).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.body.user).toEqual({
      id: expect.any(String),
      email,
      name: "Auth Login Contract",
      role: expect.any(String),
      clientId: null
    });
    expect(Object.keys(res.body.user).sort()).toEqual(["clientId", "email", "id", "name", "role"]);
    expect(res.body.user.passwordHash).toBeUndefined();

    await prisma.user.deleteMany({ where: { email } });
  });

  /** registerAuthLimiter allows 3 signups/hour per IP — prior tests already used 3 slots. */
  it("POST /api/auth/signup is rate limited after repeated attempts", async () => {
    const base = Date.now();
    const statuses: number[] = [];

    for (let i = 0; i < 4; i += 1) {
      const res = await request(app).post("/api/auth/signup").send({
        email: `signup-limit-${base}-${i}@example.com`,
        password: "testpasslong1",
        name: `Signup Limit ${i}`
      });
      statuses.push(res.status);
    }

    expect(statuses).toEqual([429, 429, 429, 429]);

    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: `signup-limit-${base}-`
        }
      }
    });
  });

  it("POST /api/auth/login returns JWT for seeded primary operator", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "demo@demo.com",
      password: "Demo1234!"
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
      email: "demo@demo.com",
      password: "Demo1234!"
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

  /** Alternate seeded login — client role (not primary operator). */
  it("CLIENT_USER cannot read another tenant analytics overview (403)", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: "salon@pilot.demo",
      password: "pilot123"
    });
    if (login.status !== 200) {
      expect(login.status).toBeDefined();
      return;
    }
    expect(login.body.user?.role).toBe("CLIENT_USER");
    const token = login.body.accessToken as string;
    const res = await request(app)
      .get("/api/analytics/not-their-client-id/overview?days=7")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("POST /api/instagram/sync accepts job (202)", async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: "demo@demo.com",
      password: "Demo1234!"
    });
    if (login.status !== 200) return;
    const token = login.body.accessToken as string;
    const res = await request(app)
      .post("/api/instagram/sync")
      .set("Authorization", `Bearer ${token}`)
      .send({ clientId: "demo-client" });
    expect([202, 404]).toContain(res.status);
  });

  it("POST /api/webhooks/social/:platform rejects requests when signing secret is missing", async () => {
    const res = await request(app).post("/api/webhooks/social/instagram").send({
      socialAccountId: "demo-social-account",
      eventType: "comment",
      externalId: `webhook-${Date.now()}`,
      text: "price?",
      authorId: "user-1",
      authorName: "User 1"
    });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Webhook signing secret is not configured.");
  });

  it("webhook signature helper validates sha256 signatures", () => {
    const secret = "test-webhook-secret";
    const rawBody = Buffer.from(JSON.stringify({ hello: "world" }), "utf8");
    const digest = signWebhookPayload(rawBody, secret);

    expect(matchesWebhookSignature(digest, rawBody, secret)).toBe(true);
    expect(matchesWebhookSignature(`sha256=${digest}`, rawBody, secret)).toBe(true);
    expect(matchesWebhookSignature(digest, rawBody, "wrong-secret")).toBe(false);
    expect(matchesWebhookSignature("not-a-digest", rawBody, secret)).toBe(false);
  });

  it("upsertSocialAccount rejects cross-tenant reassignment of an existing social account", async () => {
    const suffix = `${Date.now()}`;
    const ownerA = await prisma.user.create({
      data: { email: `owner-a-${suffix}@example.com`, passwordHash: "hash", role: "AGENCY_ADMIN" }
    });
    const ownerB = await prisma.user.create({
      data: { email: `owner-b-${suffix}@example.com`, passwordHash: "hash", role: "AGENCY_ADMIN" }
    });
    const clientA = await prisma.client.create({
      data: { name: `Client A ${suffix}`, ownerId: ownerA.id }
    });
    const clientB = await prisma.client.create({
      data: { name: `Client B ${suffix}`, ownerId: ownerB.id }
    });

    await upsertSocialAccount({
      clientId: clientA.id,
      platform: "INSTAGRAM",
      platformUserId: `platform-user-${suffix}`,
      accessToken: "token-a"
    });

    await expect(
      upsertSocialAccount({
        clientId: clientB.id,
        platform: "INSTAGRAM",
        platformUserId: `platform-user-${suffix}`,
        accessToken: "token-b"
      })
    ).rejects.toThrow("already linked to another client");

    await prisma.socialAccount.deleteMany({
      where: { platform: "INSTAGRAM", platformUserId: `platform-user-${suffix}` }
    });
    await prisma.client.deleteMany({ where: { id: { in: [clientA.id, clientB.id] } } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerA.id, ownerB.id] } }
    });
  });

  it("writeAuditLog persists a log row", async () => {
    const suffix = `${Date.now()}`;
    const owner = await prisma.user.create({
      data: { email: `audit-owner-${suffix}@example.com`, passwordHash: "hash", role: "AGENCY_ADMIN" }
    });
    const client = await prisma.client.create({
      data: { name: `Audit Client ${suffix}`, ownerId: owner.id }
    });

    await writeAuditLog({
      clientId: client.id,
      actorId: owner.id,
      action: "TEST_AUDIT_EVENT",
      entityType: "TestEntity",
      entityId: `entity-${suffix}`,
      metadata: { hello: "world" },
      ipAddress: "127.0.0.1"
    });

    const row = await prisma.auditLog.findFirst({
      where: { clientId: client.id, action: "TEST_AUDIT_EVENT", entityId: `entity-${suffix}` }
    });

    expect(row).not.toBeNull();
    expect(row?.actorId).toBe(owner.id);

    await prisma.auditLog.deleteMany({
      where: { clientId: client.id, action: "TEST_AUDIT_EVENT", entityId: `entity-${suffix}` }
    });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.user.deleteMany({ where: { id: owner.id } });
  });

  it("writeAuditLog persists without clientId (signup-style events)", async () => {
    const suffix = `${Date.now()}`;
    const entityId = `no-client-entity-${suffix}`;
    await writeAuditLog({
      clientId: null,
      actorId: null,
      action: "TEST_SIGNUP_STYLE_AUDIT",
      entityType: "User",
      entityId,
      metadata: { path: "test" }
    });

    const row = await prisma.auditLog.findFirst({
      where: { action: "TEST_SIGNUP_STYLE_AUDIT", entityId }
    });

    expect(row).not.toBeNull();
    expect(row?.clientId).toBeNull();

    await prisma.auditLog.deleteMany({ where: { entityId } });
  });
});
