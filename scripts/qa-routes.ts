import fs from "fs";
import path from "path";

const ROUTES_DIR = path.join(process.cwd(), "src", "routes");
const issues: string[] = [];

function auditFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const fileName = path.basename(filePath);

  const isPublicAllowed =
    filePath.includes("webhook") ||
    filePath.includes("billingWebhook") ||
    filePath.includes("health") ||
    filePath.includes("briefingPublic") ||
    filePath.includes("index.ts") ||
    filePath.includes("sse.ts");

  const handlerRegex = /\b\w*Router\.(get|post|put|delete|patch)\([^,]+,\s*async/g;
  const handlers = content.match(handlerRegex) ?? [];
  const catches = content.match(/catch\s*\(/g) ?? [];
  // Soft heuristic: only flag when a file has async handlers but zero catches.
  if (handlers.length > 0 && catches.length === 0 && !isPublicAllowed) {
    issues.push(`[${fileName}] Async handlers detected with no local catch blocks`);
  }

  if (
    (content.includes("req.params.clientId") || content.includes("const { clientId } = req.params")) &&
    !content.includes("z.object({ clientId: z.string().min(1) })") &&
    !content.includes("if (!clientId)")
  ) {
    issues.push(`[${fileName}] Uses clientId from params without explicit validation guard`);
  }

  if (content.includes("res.json(err)") || content.includes("res.status(500).json(err)")) {
    issues.push(`[${fileName}] Raw error object sent to client — leaks internals`);
  }

  const exempt = isPublicAllowed || filePath.includes("auth");
  const hasAuth =
    content.includes("authenticate") ||
    content.includes("requireAgency") ||
    content.includes("requireRole(") ||
    content.includes("resolveTenant") ||
    content.includes("assertTenantAccess");
  if (!exempt && !hasAuth) {
    issues.push(`[${fileName}] No auth/tenant middleware detected — may be accidentally public`);
  }
}

for (const f of fs.readdirSync(ROUTES_DIR).filter((x) => x.endsWith(".ts"))) {
  auditFile(path.join(ROUTES_DIR, f));
}

if (issues.length === 0) {
  console.log("✅ Route audit passed — no issues found");
} else {
  console.log(`❌ Found ${issues.length} route issues:\n`);
  for (const i of issues) console.log(" •", i);
  process.exit(1);
}
