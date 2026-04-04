import { PdfService } from "./pdfService";

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  return PdfService.generatePdf({ html });
}
