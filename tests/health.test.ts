import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { redisConnection } from "../src/lib/redis";

const VITEST_PLACEHOLDER_DATABASE_URL = "postgresql://test:test@localhost:5432/test";
const hasDb =
  Boolean(process.env.DATABASE_URL?.trim()) &&
  process.env.DATABASE_URL !== VITEST_PLACEHOLDER_DATABASE_URL;

const run = hasDb ? describe : describe.skip;

run("Health route diagnostics", () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
    await redisConnection?.quit().catch(() => {});
  });

  it("returns database identity and latest migration for /api/health/db", async () => {
    const res = await request(app).get("/api/health/db");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      database: {
        host: expect.any(String),
        name: expect.any(String),
        reachable: true
      },
      migrations: {
        latest: expect.anything(),
        appliedAt: expect.anything()
      }
    });
  });
});
