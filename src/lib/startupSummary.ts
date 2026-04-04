import { emailConfig, env } from "../config/env";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { isSmtpConfigured, isTwilioWhatsAppConfigured } from "../services/whatsappSender";

/** Treats empty strings and `your_*_here` placeholders as unset. */
function isPlaceholderToken(value: string | undefined): boolean {
  const t = value?.trim() ?? "";
  if (!t) return true;
  return /^your_.+_here$/i.test(t);
}

function isAnthropicConfigured(): boolean {
  const k = env.ANTHROPIC_API_KEY?.trim();
  return Boolean(k && !isPlaceholderToken(k));
}

function isEmailConfigured(): boolean {
  if (isSmtpConfigured()) return true;
  const postmark = process.env.POSTMARK_API_TOKEN?.trim();
  if (postmark && !isPlaceholderToken(postmark)) return true;
  if (emailConfig.provider === "ses") {
    const k = process.env.AWS_SES_ACCESS_KEY?.trim();
    const s = process.env.AWS_SES_SECRET_KEY?.trim();
    const r = process.env.AWS_SES_REGION?.trim();
    return Boolean(k && s && r && !isPlaceholderToken(k));
  }
  return false;
}

function isWhatsAppCloudIngressConfigured(): boolean {
  return Boolean(
    env.WA_PHONE_NUMBER_ID?.trim() &&
      env.WA_GRAPH_ACCESS_TOKEN &&
      env.WA_APP_SECRET?.trim() &&
      env.WEBHOOK_VERIFY_TOKEN?.trim()
  );
}

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
    isAnthropicConfigured()
      ? "✅ Claude AI: configured"
      : "⚠️ Claude AI: not configured (optional)"
  );

  lines.push(
    isWhatsAppCloudIngressConfigured()
      ? "✅ WhatsApp: configured"
      : isTwilioWhatsAppConfigured()
        ? "✅ WhatsApp: Twilio configured"
        : "⚠️ WhatsApp: not configured (optional)"
  );

  lines.push(
    isEmailConfigured() ? "✅ Email: configured" : "⚠️ Email: not configured (optional)"
  );

  const ig = Boolean(env.INSTAGRAM_APP_ID || env.FACEBOOK_APP_ID);
  lines.push(
    ig
      ? "✅ Instagram API: OAuth app configured"
      : "⚠️ Instagram API: OAuth not configured (optional)"
  );

  lines.push(
    env.PDF_GENERATION === "disabled"
      ? "✅ PDF: disabled (PDF_GENERATION=disabled)"
      : env.GOTENBERG_URL?.trim()
        ? "✅ PDF: Gotenberg (GOTENBERG_URL)"
        : process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
          ? "✅ PDF: Puppeteer (PUPPETEER_EXECUTABLE_PATH)"
          : "ℹ️ PDF: Puppeteer — needs PUPPETEER_EXECUTABLE_PATH or Gotenberg"
  );

  lines.push(`✅ Server ready on port ${port}`);

  logger.info(lines.join("\n"));
}
