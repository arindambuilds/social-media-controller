import { PrismaClient } from "@prisma/client";
/**
 * Prisma singleton — prevents multiple PrismaClient instances during
 * Next.js / ts-node hot-reload in development.
 *
 * Usage (everywhere in the codebase):
 *   import { prisma } from "@/lib/prisma";
 *
 * Never instantiate `new PrismaClient()` outside this file.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
