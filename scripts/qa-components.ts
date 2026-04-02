import fs from "fs";
import path from "path";

const root = path.join(process.cwd(), "dashboard", "components");
const issues: string[] = [];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.isFile() && p.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

function audit(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const name = path.relative(root, filePath).replace(/\\/g, "/");

  const effects = (content.match(/useEffect\(/g) ?? []).length;
  // Heuristic: ignore files that clearly include cleanup-return patterns and dependency arrays.
  const depMarkers = (content.match(/\],\s*\[|\[\s*[^\]]*\]\s*\)/g) ?? []).length;
  if (effects > 0 && depMarkers === 0) {
    issues.push(`[${name}] useEffect detected but no dependency-array marker found`);
  }

  const fetches = (content.match(/apiFetch\(/g) ?? []).length;
  const catches = (content.match(/\.catch\(/g) ?? []).length;
  const hasTryCatch = content.includes("try {") && content.includes("catch");
  if (fetches > 0 && catches === 0 && !hasTryCatch) {
    issues.push(`[${name}] apiFetch used but no catch/try-catch found`);
  }

  if (fetches > 0 && !/loading|skeleton|isLoading|pending/i.test(content)) {
    issues.push(`[${name}] Fetches data but no loading state keyword found`);
  }

  if (content.includes("clientId={clientId}") && !content.includes("if (!clientId)") && !content.includes("clientId &&")) {
    issues.push(`[${name}] Passes clientId to child without guard — may pass undefined`);
  }

  if (content.includes("<img") && !content.includes("onError")) {
    issues.push(`[${name}] <img> tag without onError fallback`);
  }
}

for (const f of walk(root)) audit(f);

if (issues.length === 0) {
  console.log("✅ Component audit passed");
} else {
  console.log(`❌ Found ${issues.length} component issues:\n`);
  for (const i of issues) console.log(" •", i);
  process.exit(1);
}
