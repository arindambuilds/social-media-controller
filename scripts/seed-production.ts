/**
 * INVESTIGATION (Steps 1–4) — production incident / demo user
 *
 * STEP 1 — prisma/schema.prisma `User` model:
 *   - Hashed password field: `passwordHash` (String?, optional). NOT `password`.
 *   - Email: `email` (String @unique). No @@map on `User`; PostgreSQL column names match Prisma field names (quoted "passwordHash", "email").
 *   - id: `String @id @default(cuid())`.
 *   - Required on create: `email`; `role` defaults AGENCY_ADMIN; `createdAt`/`updatedAt` managed by Prisma (@updatedAt on update).
 *
 * STEP 2 — Login path: `src/routes/auth.ts` → `login()` in `src/services/authService.ts`.
 *   - `findUnique({ where: { email } })` with `select.passwordHash: true`.
 *   - `bcrypt.compare(input.password, user.passwordHash)` — library: `bcrypt` (same as this script).
 *
 * STEP 3 — prisma/seed.ts: demo user `demo@demo.com` already upserted with `passwordHash`; production failures were connectivity / migration / wrong column in ad-hoc SQL, not field name in app code.
 *
 * STEP 4 — package.json dependencies: `bcrypt` and `bcryptjs` both present; auth + this script use `bcrypt` only.
 *
 * Run (production Supabase URL from env only, never hardcoded):
 *   DATABASE_URL="postgresql://..." npx tsx scripts/seed-production.ts
 */

import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const DEMO_EMAIL = "demo@demo.com";
const DEMO_PASSWORD = "Demo1234!";
const BCRYPT_ROUNDS = 10;
const DEMO_CLIENT_ID = "demo-client";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Run: DATABASE_URL="postgresql://user:pass@host:5432/postgres" npx tsx scripts/seed-production.ts'
    );
  }

  const prisma = new PrismaClient();

  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
    const demoClient = await prisma.client.findUnique({
      where: { id: DEMO_CLIENT_ID },
      select: { id: true }
    });
    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: {
        passwordHash,
        name: "Demo User",
        role: "AGENCY_ADMIN",
        clientId: demoClient?.id ?? null
      },
      create: {
        email: DEMO_EMAIL,
        name: "Demo User",
        passwordHash,
        role: "AGENCY_ADMIN",
        clientId: demoClient?.id
      }
    });

    console.log(
      `seed-production: upserted user id=${user.id} email=${user.email} clientId=${demoClient?.id ?? "null"}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
