/**
 * Builds docs/mvp-status-one-pager.pdf from docs/mvp-status-one-pager.md
 * using system Microsoft Edge (no Chromium download).
 *
 * Run: npm run pdf:mvp-one-pager
 * Requires devDependencies: marked, puppeteer-core
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const mdPath = path.join(root, "docs", "mvp-status-one-pager.md");
const outPath = path.join(root, "docs", "mvp-status-one-pager.pdf");

const edgeCandidates = [
  path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
  path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe")
];

function findEdge() {
  for (const p of edgeCandidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const edge = findEdge();
if (!edge) {
  console.error("Microsoft Edge not found. Install Edge or set PUPPETEER_EXECUTABLE_PATH to a Chromium-based browser.");
  process.exit(1);
}

const md = fs.readFileSync(mdPath, "utf8");
const body = await marked.parse(md);
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Segoe UI, system-ui, sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px;
    line-height: 1.45; font-size: 11pt; color: #111; }
  h1 { font-size: 18pt; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
  h2 { font-size: 13pt; margin-top: 1.25em; }
  table { border-collapse: collapse; width: 100%; margin: 0.75em 0; font-size: 10pt; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  code { font-family: Consolas, monospace; font-size: 9.5pt; background: #f4f4f4; padding: 1px 4px; }
  pre code { display: block; padding: 8px; overflow-x: auto; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
  @media print { body { margin: 0; max-width: none; } }
</style>
</head>
<body>${body}</body>
</html>`;

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || edge,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
await page.pdf({
  path: outPath,
  format: "A4",
  printBackground: true,
  margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" }
});
await browser.close();
console.log("Wrote", outPath);
