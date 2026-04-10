import path from "path";
import fs from "fs/promises";
import { prisma } from "../lib/prisma";
import { ensureDirectoryExists } from "../utils/fs.js";

export type PdfReportStatus = "pending" | "queued" | "ready" | "failed";

export type CreateReportInput = {
  clientId: string;
  userId: string;
  reportType: string;
};

export async function createReport(input: CreateReportInput) {
  return prisma.report.create({
    data: {
      clientId: input.clientId,
      userId: input.userId,
      reportType: input.reportType,
      pdfStatus: "queued",
      pdfJobId: undefined,
      pdfUrl: undefined
    }
  });
}

export async function updateReportStatus(
  reportId: string,
  status: PdfReportStatus,
  payload: { pdfUrl?: string; pdfJobId?: string; failureReason?: string } = {}
) {
  return prisma.report.update({
    where: { id: reportId },
    data: {
      pdfStatus: status,
      pdfUrl: payload.pdfUrl ?? undefined,
      pdfJobId: payload.pdfJobId ?? undefined,
      failureReason: payload.failureReason ?? undefined
    }
  });
}

export async function getReportStatus(reportId: string) {
  return prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      clientId: true,
      userId: true,
      reportType: true,
      pdfStatus: true,
      pdfUrl: true,
      failureReason: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export function getReportPdfPath(reportId: string) {
  return path.join(process.cwd(), "uploads", "reports", `${reportId}.pdf`);
}

export function getReportPdfUrl(reportId: string) {
  return `/uploads/reports/${reportId}.pdf`;
}

export async function saveReportPdf(reportId: string, pdfBuffer: Buffer) {
  const filePath = getReportPdfPath(reportId);
  await ensureDirectoryExists(path.dirname(filePath));
  await fs.writeFile(filePath, pdfBuffer);
  return getReportPdfUrl(reportId);
}
