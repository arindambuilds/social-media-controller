import type { Browser, Page, PDFOptions } from "puppeteer-core";
import puppeteer from "puppeteer-core";

export type PdfGenerateInput = {
  html: string;
  options?: {
    format?: "A4";
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    timeoutMs?: number;
  };
};

const DEFAULT_TIMEOUT_MS = 20_000;
let browser: Browser | null = null;
let jobsSinceBrowserRecycle = 0;

function recycleAfterJobs(): number {
  const n = Number(process.env.PDF_RECYCLE_AFTER_JOBS ?? "25");
  return Number.isFinite(n) && n >= 1 ? Math.min(200, Math.floor(n)) : 25;
}

function marginMmToInches(raw?: string): number {
  if (!raw) return 16 / 25.4;
  const m = /^([\d.]+)\s*mm$/i.exec(raw.trim());
  if (m) {
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? n / 25.4 : 16 / 25.4;
  }
  return 16 / 25.4;
}

/**
 * Gotenberg 8+ `/forms/chromium/convert/html` — no Puppeteer on the worker when `GOTENBERG_URL` is set.
 * Header/footer templates are not mapped (use embedded HTML for branding).
 */
async function generatePdfViaGotenberg(
  baseUrl: string,
  html: string,
  options: PdfGenerateInput["options"] | undefined,
  timeoutMs: number
): Promise<Buffer> {
  const root = baseUrl.replace(/\/$/, "");
  const form = new FormData();
  form.append("files", new Blob([html], { type: "text/html" }), "index.html");
  form.append("marginTop", String(marginMmToInches(options?.margin?.top)));
  form.append("marginBottom", String(marginMmToInches(options?.margin?.bottom)));
  form.append("marginLeft", String(marginMmToInches(options?.margin?.left)));
  form.append("marginRight", String(marginMmToInches(options?.margin?.right)));
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${root}/forms/chromium/convert/html`, {
      method: "POST",
      body: form,
      signal: ac.signal
    });
    if (!res.ok) {
      const te = await res.text();
      throw new Error(`Gotenberg HTTP ${res.status}: ${te.slice(0, 240)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number, stage: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`PDF ${stage} timed out after ${timeoutMs}ms.`)), timeoutMs);
    });
    return await Promise.race([task, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) {
    return browser;
  }
  browser = null;
  browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    handleSIGINT: false,
    handleSIGTERM: false,
  });
  return browser;
}

async function getPage(): Promise<{ page: Page; cleanup: () => Promise<void> }> {
  const b = await getBrowser();
  let page: Page;
  try {
    page = await b.newPage();
  } catch {
    // browser died mid-session — relaunch once
    browser = null;
    const fresh = await getBrowser();
    page = await fresh.newPage();
  }
  return {
    page,
    cleanup: async () => { try { await page.close(); } catch {} }
  };
}

/**
 * Renders arbitrary HTML via Puppeteer or Gotenberg. User-controlled strings must be
 * sanitized before being embedded in HTML (see `sanitizeHtml` in `src/utils/sanitize.ts` and report templates).
 */
export class PdfService {
  static async closeSharedBrowser(): Promise<void> {
    const currentBrowser = browser;
    browser = null;
    if (!currentBrowser) return;
    try {
      await currentBrowser.close();
    } catch {
      /* ignore */
    }
  }

  /**
   * Limits RSS creep from long-lived Chromium: recycle after N PDF jobs in the worker process.
   */
  static async notePdfJobComplete(): Promise<void> {
    jobsSinceBrowserRecycle += 1;
    const cap = recycleAfterJobs();
    if (jobsSinceBrowserRecycle < cap) return;
    jobsSinceBrowserRecycle = 0;
    await PdfService.closeSharedBrowser();
  }

  static async generatePdf({ html, options }: PdfGenerateInput): Promise<Buffer> {
    if (process.env.PDF_GENERATION === "disabled") {
      throw new Error("PDF generation is disabled (set PDF_GENERATION=disabled in .env).");
    }
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const gotenberg = process.env.GOTENBERG_URL?.trim();
    if (gotenberg) {
      return generatePdfViaGotenberg(gotenberg, html, options, timeoutMs);
    }

    const { page, cleanup } = await withTimeout(getPage(), timeoutMs, "page init");
    try {
      /** `networkidle0` can stall 30s+ on external chart URLs; `load` bounds time and stabilizes the event loop. */
      await withTimeout(page.setContent(html, { waitUntil: "load", timeout: timeoutMs }), timeoutMs, "html render");

      const pdfOptions: PDFOptions = {
        format: options?.format ?? "A4",
        printBackground: true,
        margin: {
          top: options?.margin?.top ?? "16mm",
          right: options?.margin?.right ?? "12mm",
          bottom: options?.margin?.bottom ?? "16mm",
          left: options?.margin?.left ?? "12mm"
        },
        displayHeaderFooter: options?.displayHeaderFooter ?? false,
        headerTemplate: options?.headerTemplate ?? "<div></div>",
        footerTemplate: options?.footerTemplate ?? "<div></div>"
      };
      const pdf = await withTimeout(page.pdf(pdfOptions), timeoutMs, "pdf generation");
      return Buffer.from(pdf);
    } catch (err) {
      throw err instanceof Error ? err : new Error("PDF generation failed.");
    } finally {
      await cleanup();
    }
  }
}

process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

