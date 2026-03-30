import { env } from "../config/env";
import { prisma } from "./prisma";
import { isSmtpConfigured, isTwilioWhatsAppConfigured } from "../services/whatsappSender";

export async function printStartupSummary(port: number): Promise<void> {
  const lines: string[] = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    lines.push("✅ Database: connected");
  } catch {
    lines.push("❌ Database: not connected");
  }

  lines.push("✅ JWT: configured");

  lines.push(
    env.ANTHROPIC_API_KEY?.trim()
      ? "✅ Claude AI: configured"
      : "⚠️ Claude AI: not configured (optional)"
  );

  lines.push(
    isTwilioWhatsAppConfigured()
      ? "✅ WhatsApp: Twilio configured"
      : "⚠️ WhatsApp: not configured (optional)"
  );

  lines.push(
    isSmtpConfigured() ? "✅ Email: SMTP configured" : "⚠️ Email: not configured (optional)"
  );

  const ig = Boolean(env.INSTAGRAM_APP_ID || env.FACEBOOK_APP_ID);
  lines.push(
    ig
      ? "✅ Instagram API: OAuth app configured"
      : "⚠️ Instagram API: OAuth not configured (optional)"
  );

  lines.push(
    env.GOTENBERG_URL?.trim()
      ? "✅ PDF: Gotenberg (GOTENBERG_URL)"
      : "ℹ️ PDF: Puppeteer when PUPPETEER_EXECUTABLE_PATH set (or configure Gotenberg)"
  );

  lines.push(`✅ Server ready on port ${port}`);

  console.log(lines.join("\n"));
}
