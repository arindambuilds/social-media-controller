import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
// JSDOM Window is structurally compatible with DOMPurify's WindowLike; types differ across packages.
const purify = DOMPurify(window as Parameters<typeof DOMPurify>[0]);

/**
 * Sanitize user-controlled strings before embedding in PDF/HTML (Puppeteer / Gotenberg).
 * Strips scripts and network-capable attributes; allows a small subset of formatting tags.
 */
export function sanitizeHtml(dirty: string): string {
  return purify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: [],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "link"],
    FORBID_ATTR: ["onerror", "onload", "href", "src", "action"]
  });
}
