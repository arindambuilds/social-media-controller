import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
p.user.findUnique({ where: { email: "demo@demo.com" }, select: { id: true, email: true, role: true, clientId: true } })
  .then(u => { console.log("DB result:", JSON.stringify(u, null, 2)); })
  .catch(e => { console.error("Error:", e.message); })
  .finally(() => p.$disconnect());
