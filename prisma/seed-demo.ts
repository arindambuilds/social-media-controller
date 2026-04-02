/**
 * Demo MSMEs for PulseOS pitches (AromaSilkHouse + RealtyDemo).
 * Run: SEED_DEMO=true npx tsx prisma/seed-demo.ts
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

if (process.env.SEED_DEMO !== "true" && process.env.NODE_ENV === "production") {
  process.exit(0);
}

const ROUNDS = 10;

const odiaNames = [
  "ସୁନ୍ଦର ପଟ୍ଟନାୟକ",
  "ମନୋଜ ମିଶ୍ର",
  "ଅନିତା ଦାସ",
  "ରମେଶ ସାହୁ",
  "ପ୍ରିୟଙ୍କା ନାୟକ",
  "ବିକାଶ ରାଉତ"
] as const;

const enNames = [
  "Aditya Khanna",
  "Neha Kapoor",
  "Rahul Verma",
  "Sneha Iyer",
  "Vikram Menon",
  "Kavita Nair"
] as const;

async function main(): Promise<void> {
  const hash = await bcrypt.hash("DemoSeedLocalOnly1", ROUNDS);

  const aromaOwner = await prisma.user.upsert({
    where: { email: "pulse-aroma-demo@example.com" },
    create: {
      email: "pulse-aroma-demo@example.com",
      name: "Aroma Owner",
      passwordHash: hash,
      role: "AGENCY_ADMIN"
    },
    update: { name: "Aroma Owner" }
  });

  const realtyOwner = await prisma.user.upsert({
    where: { email: "pulse-realty-demo@example.com" },
    create: {
      email: "pulse-realty-demo@example.com",
      name: "Realty Owner",
      passwordHash: hash,
      role: "AGENCY_ADMIN"
    },
    update: { name: "Realty Owner" }
  });

  let aroma = await prisma.client.findFirst({ where: { name: "AromaSilkHouse" } });
  if (!aroma) {
    aroma = await prisma.client.create({
      data: {
        name: "AromaSilkHouse",
        ownerId: aromaOwner.id,
        whatsappNumber: "+919876543210",
        preferredInstagramHandle: "aromasilkhouse",
        briefingHourIst: 9,
        language: "or",
        pioneerCohort: true,
        pioneerPriceInrUntil: new Date(Date.now() + 90 * 86400000),
        demoEndsAt: new Date(Date.now() + 3 * 86400000),
        businessType: "retail"
      }
    });
  } else {
    aroma = await prisma.client.update({
      where: { id: aroma.id },
      data: {
        language: "or",
        pioneerCohort: true,
        briefingHourIst: 9,
        whatsappNumber: aroma.whatsappNumber ?? "+919876543210",
        preferredInstagramHandle: aroma.preferredInstagramHandle ?? "aromasilkhouse"
      }
    });
  }

  let realty = await prisma.client.findFirst({ where: { name: "RealtyDemo" } });
  if (!realty) {
    realty = await prisma.client.create({
      data: {
        name: "RealtyDemo",
        ownerId: realtyOwner.id,
        whatsappNumber: "+919811122233",
        preferredInstagramHandle: "realtydemobbsr",
        briefingHourIst: 9,
        language: "en",
        pioneerCohort: true,
        businessType: "real_estate"
      }
    });
  } else {
    realty = await prisma.client.update({
      where: { id: realty.id },
      data: {
        language: "en",
        pioneerCohort: true,
        briefingHourIst: 9
      }
    });
  }

  await prisma.lead.deleteMany({
    where: { source: "demo-seed", clientId: { in: [aroma.id, realty.id] } }
  });

  for (let i = 0; i < 6; i++) {
    await prisma.lead.create({
      data: {
        clientId: aroma.id,
        source: "demo-seed",
        sourceId: `aroma-${i}`,
        contactName: odiaNames[i]!,
        contactPhone: `+9198765${10000 + i}`,
        status: "NEW"
      }
    });
    await prisma.lead.create({
      data: {
        clientId: realty.id,
        source: "demo-seed",
        sourceId: `realty-${i}`,
        contactName: enNames[i]!,
        contactPhone: `+9198111${20000 + i}`,
        status: "NEW"
      }
    });
  }

  console.log("seed-demo: AromaSilkHouse", aroma.id, "RealtyDemo", realty.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
