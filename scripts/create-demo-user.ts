/**
 * Standalone demo user seed — safe to run multiple times (upsert).
 * Creates: demo@demo.com / Demo1234! with AGENCY_ADMIN role + demo-client.
 *
 * Run against production:
 *   npx tsx scripts/create-demo-user.ts
 * (DATABASE_URL and DIRECT_URL are loaded from .env automatically)
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const BCRYPT_ROUNDS = 10;
const DEMO_EMAIL = "demo@demo.com";
const DEMO_PASSWORD = "Demo1234!";
const DEMO_CLIENT_ID = "demo-client";

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log("Connecting to database...");
    await prisma.$connect();
    console.log("Connected.");

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

    // Upsert the demo client first (demo@demo.com needs a clientId)
    // We need an owner — upsert the user first without clientId, then link
    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: {
        passwordHash,
        name: "Demo User",
        role: "AGENCY_ADMIN",
      },
      create: {
        email: DEMO_EMAIL,
        name: "Demo User",
        passwordHash,
        role: "AGENCY_ADMIN",
      },
    });
    console.log(`User upserted: id=${user.id} email=${user.email}`);

    // Upsert the demo client
    const client = await prisma.client.upsert({
      where: { id: DEMO_CLIENT_ID },
      update: {
        name: "Aroma Silk House",
        ownerId: user.id,
      },
      create: {
        id: DEMO_CLIENT_ID,
        name: "Aroma Silk House",
        ownerId: user.id,
      },
    });
    console.log(`Client upserted: id=${client.id} name=${client.name}`);

    // Link user to client
    await prisma.user.update({
      where: { id: user.id },
      data: { clientId: client.id },
    });
    console.log(`User linked to client: clientId=${client.id}`);

    // Verify the hash works
    const valid = await bcrypt.compare(DEMO_PASSWORD, passwordHash);
    console.log(`Password hash verification: ${valid ? "PASS ✓" : "FAIL ✗"}`);

    console.log("\n✅ Demo user ready:");
    console.log(`   Email:    ${DEMO_EMAIL}`);
    console.log(`   Password: ${DEMO_PASSWORD}`);
    console.log(`   Role:     AGENCY_ADMIN`);
    console.log(`   ClientId: ${client.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("create-demo-user failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
