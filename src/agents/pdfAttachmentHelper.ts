import { generatePdfFromHtml } from "../services/pdfGenerator";
import type { EmailAttachment } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function createPdfAttachment(
  htmlContent: string,
  filename: string = "document.pdf"
): Promise<EmailAttachment> {
  const pdfBuffer = await generatePdfFromHtml(htmlContent);
  return { filename, content: pdfBuffer, contentType: "application/pdf" };
}

export async function createTranscriptAttachment(
  conversationId: string,
  messages: Array<{ role: string; content: string; timestamp: Date }>
): Promise<EmailAttachment> {
  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a;">
    <h1>Conversation transcript</h1>
    <p>Conversation ID: ${escapeHtml(conversationId)}</p>
    ${messages
      .map(
        (message) => `
          <section style="margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
            <p><strong>${escapeHtml(message.role)}</strong></p>
            <p>${escapeHtml(message.content).replaceAll("\n", "<br />")}</p>
            <p style="color: #64748b; font-size: 12px;">${escapeHtml(message.timestamp.toISOString())}</p>
          </section>`
      )
      .join("")}
  </body>
</html>`;
  return createPdfAttachment(html, `transcript-${conversationId}.pdf`);
}
