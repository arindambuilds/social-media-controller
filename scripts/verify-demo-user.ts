import "dotenv/config";
import { prisma } from "../src/lib/prisma";

prisma.user.findUnique({ where: { email: "demo@demo.com" }, select: { id: true, email: true, role: true, clientId: true } })
  .then(u => { console.log("DB result:", JSON.stringify(u, null, 2)); })
  .catch(e => { console.error("Error:", e.message); })
  .finally(() => prisma.$disconnect());
