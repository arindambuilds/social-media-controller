import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type ConversionRecord = {
  userId: string | null;
  plan: string;
  source: string | null;
  feature: string | null;
  revenue: number;
  timestamp: number;
  customerId: string | null;
  customerEmail: string | null;
  priceId: string | null;
  sessionId: string | null;
};

const ANALYTICS_DIR = path.join(process.cwd(), ".analytics");
const CONVERSIONS_FILE = path.join(ANALYTICS_DIR, "conversions.ndjson");

export async function persistConversion(record: ConversionRecord): Promise<void> {
  await mkdir(ANALYTICS_DIR, { recursive: true });
  await appendFile(CONVERSIONS_FILE, `${JSON.stringify(record)}\n`, "utf8");
}

