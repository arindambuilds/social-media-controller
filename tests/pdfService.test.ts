import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfService } from "../src/services/pdfService";

describe("PdfService (Gotenberg path)", () => {
  const prevGotenberg = process.env.GOTENBERG_URL;
  const prevPuppeteer = process.env.PUPPETEER_EXECUTABLE_PATH;

  beforeEach(() => {
    process.env.GOTENBERG_URL = "http://localhost:3333";
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
  });

  afterEach(() => {
    process.env.GOTENBERG_URL = prevGotenberg;
    if (prevPuppeteer) process.env.PUPPETEER_EXECUTABLE_PATH = prevPuppeteer;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("happy-path: Gotenberg 200 returns PDF buffer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer
      })
    );
    const buf = await PdfService.generatePdf({ html: "<html><body>Hi</body></html>" });
    expect(buf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("branding strings appear in HTML sent to Gotenberg (multipart body)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4)
    });
    vi.stubGlobal("fetch", fetchMock);
    const html =
      "<html><body>agencyName Acme Corp brandColor #ff00aa logoUrl https://cdn.example/logo.png</body></html>";
    await PdfService.generatePdf({ html });
    expect(fetchMock).toHaveBeenCalled();
    const url = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/forms/chromium/convert/html");
    const body = fetchMock.mock.calls[0]?.[1]?.body;
    expect(body).toBeDefined();
  });

  it("error-path: Gotenberg 500 throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "boom"
      })
    );
    await expect(PdfService.generatePdf({ html: "<p>x</p>" })).rejects.toThrow(/Gotenberg HTTP 500/);
  });
});
