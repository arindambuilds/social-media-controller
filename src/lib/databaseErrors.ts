import { Prisma } from "@prisma/client";

/** True when the failure is likely a down / unreachable database (do not expose details to clients). */
export function isDatabaseConnectivityError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === "P1001" || err.code === "P1017";
  }
  if (err instanceof Error) {
    const m = err.message;
    if (m.includes("Can't reach database server")) return true;
    if (m.includes("ECONNREFUSED")) return true;
    if (m.includes("ETIMEDOUT")) return true;
  }
  return false;
}
