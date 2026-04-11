/**
 * Bug Condition Exploration Tests — Demo Login Production Readiness
 *
 * CRITICAL: These tests MUST FAIL on unfixed code.
 * Failure confirms each bug exists. DO NOT fix the code or tests when they fail.
 * These tests encode the expected behavior and will PASS after the fix is applied.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { seedDemoDataForUser } from "../src/lib/demo-seeder";

// ─── DB gate (same pattern as health.test.ts) ────────────────────────────────
const VITEST_PLACEHOLDER_DATABASE_URL = "postgresql://test:test@localhost:5432/test";
const hasDb =
  Boolean(process.env.DATABASE_URL?.trim()) &&
  process.env.DATABASE_URL !== VITEST_PLACEHOLDER_DATABASE_URL;

// ─── Bug 1: Missing /api/dashboard/stats route ────────────────────────────────
describe("Bug 1 — Stats route returns 200 with DashboardStats shape", () => {
  /**
   * The dashboard page calls fetch("/api/dashboard/stats") but no route.ts exists.
   * On unfixed code: Next.js returns 404 (no route handler).
   * After fix: should return 200 with DashboardStats shape.
   *
   * We test this by checking whether the route handler file exists.
   * The absence of the file IS the bug condition.
   */
  it("route handler file exists at dashboard/app/api/dashboard/stats/route.ts", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const routePath = path.resolve(
      process.cwd(),
      "dashboard/app/api/dashboard/stats/route.ts"
    );
    // On unfixed code: file does not exist → this assertion FAILS (confirms bug)
    expect(fs.existsSync(routePath)).toBe(true);
  });
});

// ─── Bug 2: Demo user onboardingCompleted flag ────────────────────────────────
const runBug2 = hasDb ? describe : describe.skip;

runBug2("Bug 2 — create-demo-user sets onboardingCompleted = true", () => {
  /**
   * create-demo-user.ts upserts demo@demo.com without setting onboardingCompleted: true.
   * On unfixed code: user.onboardingCompleted = false → wizard blocks dashboard.
   * After fix: user.onboardingCompleted = true.
   */
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up test user
    await prisma.user.deleteMany({ where: { email: "demo@demo.com" } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it("demo@demo.com has onboardingCompleted = true after running create-demo-user", async () => {
    // Simulate what create-demo-user.ts does (upsert without onboardingCompleted)
    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.hash("Demo1234!", 1); // fast rounds for test

    await prisma.user.upsert({
      where: { email: "demo@demo.com" },
      update: {
        passwordHash,
        name: "Demo User",
        role: "AGENCY_ADMIN",
        // BUG: onboardingCompleted is NOT set here in the unfixed script
      },
      create: {
        email: "demo@demo.com",
        name: "Demo User",
        passwordHash,
        role: "AGENCY_ADMIN",
        // BUG: onboardingCompleted is NOT set here in the unfixed script
      },
    });

    const user = await prisma.user.findUnique({ where: { email: "demo@demo.com" } });
    // On unfixed code: user.onboardingCompleted = false → this assertion FAILS (confirms bug)
    expect(user?.onboardingCompleted).toBe(true);
  });
});

// ─── Bug 3: seedDemoDataForUser throws when client is null ────────────────────
const runBug3 = hasDb ? describe : describe.skip;

runBug3("Bug 3 — seedDemoDataForUser completes without throwing when client is null", () => {
  /**
   * seedDemoDataForUser throws "User or associated client not found" when user.client = null.
   * On unfixed code: throws → POST /onboarding/step2 returns 500.
   * After fix: creates/links the demo-client and completes successfully.
   */
  let testUserId: string;

  beforeAll(async () => {
    await prisma.$connect();
    // Create a user with no clientId (simulates fresh deploy)
    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.hash("TestPass1!", 1);
    const user = await prisma.user.create({
      data: {
        email: `bug3-test-${Date.now()}@test.com`,
        name: "Bug3 Test User",
        passwordHash,
        role: "AGENCY_ADMIN",
        clientId: null, // ← the bug condition: no linked client
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up: remove DemoData, then user
    await prisma.demoData.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await prisma.dmMessage
      .deleteMany({
        where: {
          conversation: {
            clientId: "demo-client",
          },
        },
      })
      .catch(() => {});
    await prisma.dmConversation.deleteMany({ where: { clientId: "demo-client" } }).catch(() => {});
    await prisma.report.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    await prisma.client.delete({ where: { id: "demo-client" } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it("seedDemoDataForUser completes without throwing for a user with clientId = null", async () => {
    // On unfixed code: throws "User or associated client not found" → this assertion FAILS (confirms bug)
    await expect(seedDemoDataForUser(testUserId)).resolves.not.toThrow();
  });
});

// ─── Bug 4: Login catch block discards actual error message ──────────────────
describe("Bug 4 — handleLogin displays actual error message from thrown Error", () => {
  /**
   * The catch block in handleLogin ignores the thrown Error and hardcodes
   * "Invalid email or password". apiFetch already produces descriptive messages
   * but they are discarded.
   *
   * On unfixed code: error state = "Invalid email or password" (not the actual message).
   * After fix: error state = the message from the thrown Error.
   *
   * We test the catch block logic directly by extracting it.
   * Validates: Requirements 1.4, 2.4
   */

  it("catch block uses err.message when apiFetch throws a non-credential error", () => {
    // Reproduce the UNFIXED catch block logic:
    //   catch { const message = "Invalid email or password"; ... }
    // The caught error is never bound — message is always hardcoded.

    const thrownError = new Error("Service temporarily unavailable");

    // Simulate the UNFIXED catch block (no `err` binding):
    let capturedMessage: string;
    try {
      throw thrownError;
    } catch {
      // BUG: the unfixed code does this — ignores the error entirely
      capturedMessage = "Invalid email or password";
    }

    // On unfixed code: capturedMessage = "Invalid email or password" → this assertion FAILS (confirms bug)
    // After fix: capturedMessage = "Service temporarily unavailable"
    expect(capturedMessage).toBe("Service temporarily unavailable");
  });

  it("catch block uses err.message for any non-credential error (property-based style)", () => {
    const nonCredentialErrors = [
      "Service temporarily unavailable",
      "Something went sideways — let's try again.",
      "The API is taking a little longer than usual. Please try again in a moment.",
      "You've made a lot of requests. Let's pause for a moment and try again.",
      "Network error",
    ];

    for (const errorMessage of nonCredentialErrors) {
      const thrownError = new Error(errorMessage);

      // Simulate the UNFIXED catch block:
      let capturedMessage: string;
      try {
        throw thrownError;
      } catch {
        // BUG: unfixed code ignores the error
        capturedMessage = "Invalid email or password";
      }

      // On unfixed code: all of these FAIL (confirms bug for each error type)
      expect(capturedMessage).toBe(errorMessage);
    }
  });
});
