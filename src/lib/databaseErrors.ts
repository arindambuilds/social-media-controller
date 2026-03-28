import { Prisma } from "@prisma/client";

/** True when the failure is likely a down / unreachable database (do not expose details to clients). */
export function isDatabaseConnectivityError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === "P1001" || err.code === "P1017";
  }
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("P1001") ||
    msg.includes("P1017") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("connect ETIMEDOUT") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("Can't reach database server")
  );
}
