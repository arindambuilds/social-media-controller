import nodemailer from "nodemailer";
import twilio from "twilio";
import { isDebugBriefing } from "../lib/debugBriefing";
import { logger } from "../lib/logger";

function normalizeWhatsAppAddress(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("whatsapp:")) return t;
  return `whatsapp:${t}`;
}

function twilioConfigured(): boolean {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();
  return Boolean(sid && token && from);
}

function smtpConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const port = process.env.SMTP_PORT?.trim();
  return Boolean(host && user && pass !== undefined && pass !== "" && port);
}

export function isTwilioWhatsAppConfigured(): boolean {
  return twilioConfigured();
}

export function isSmtpConfigured(): boolean {
  return smtpConfigured();
}

/**
 * Sends a WhatsApp text via Twilio. Returns false on misconfiguration or failure — never throws.
 */
/**
 * Twilio send for BullMQ worker path: 429+ errors propagate (retries); HTTP 400 is logged and swallowed.
 * @returns message SID on success; undefined when the send is suppressed (e.g. HTTP 400).
 */
export async function sendWhatsAppStrict(to: string, message: string): Promise<string | undefined> {
  if (!twilioConfigured()) {
    throw new Error("Twilio WhatsApp is not configured");
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const token = process.env.TWILIO_AUTH_TOKEN!.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM!.trim();
  const client = twilio(sid, token);
  const toAddr = normalizeWhatsAppAddress(to);
  const fromAddr = normalizeWhatsAppAddress(from);
  try {
    const msg = await client.messages.create({
      from: fromAddr,
      to: toAddr,
      body: message
    });
    logger.info("[WhatsApp] sent successfully", { to: toAddr });
    if (isDebugBriefing()) {
      logger.info("[WhatsApp] Twilio SID", { sid: msg.sid });
    }
    return msg.sid;
  } catch (err: unknown) {
    const status = typeof err === "object" && err !== null && "status" in err ? Number((err as { status?: number }).status) : undefined;
    const code = typeof err === "object" && err !== null && "code" in err ? Number((err as { code?: number }).code) : undefined;
    if (status === 400 || code === 21211) {
      logger.warn("[WhatsApp] 400 suppressed (invalid request)", {
        message: err instanceof Error ? err.message : String(err)
      });
      return undefined;
    }
    throw err;
  }
}

export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  try {
    if (!twilioConfigured()) {
      logger.warn("WhatsApp skipped: Twilio not configured");
      return false;
    }

    const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
    const token = process.env.TWILIO_AUTH_TOKEN!.trim();
    const from = process.env.TWILIO_WHATSAPP_FROM!.trim();

    const client = twilio(sid, token);
    const toAddr = normalizeWhatsAppAddress(to);
    const fromAddr = normalizeWhatsAppAddress(from);

    await client.messages.create({
      from: fromAddr,
      to: toAddr,
      body: message
    });
    logger.info("[WhatsApp] sent successfully", { to: toAddr });
    return true;
  } catch (err) {
    logger.warn("[WhatsApp] send failed", { message: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/**
 * Plain-text email. Returns false if SMTP is not configured or send fails — never throws.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  try {
    if (!smtpConfigured()) {
      logger.warn("Email skipped: SMTP not configured");
      return false;
    }

    const host = process.env.SMTP_HOST!.trim();
    const portRaw = process.env.SMTP_PORT!.trim();
    const user = process.env.SMTP_USER!.trim();
    const pass = process.env.SMTP_PASS!.trim();
    const fromAddr = process.env.SMTP_FROM?.trim() || user;

    const port = Number(portRaw);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    await transporter.sendMail({
      from: fromAddr,
      to,
      subject,
      text: body
    });
    logger.info("[Email] sent successfully", { to });
    return true;
  } catch (err) {
    logger.warn("[Email] send failed", { message: err instanceof Error ? err.message : String(err), to });
    return false;
  }
}

/**
 * HTML + plain-text briefing email. Returns false if SMTP is not configured or send fails — never throws.
 */
export async function sendBriefingEmailHtml(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  try {
    if (!smtpConfigured()) {
      logger.warn("Email skipped: SMTP not configured");
      return false;
    }

    const host = process.env.SMTP_HOST!.trim();
    const portRaw = process.env.SMTP_PORT!.trim();
    const user = process.env.SMTP_USER!.trim();
    const pass = process.env.SMTP_PASS!.trim();
    const fromAddr = process.env.SMTP_FROM?.trim() || user;

    const port = Number(portRaw);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    await transporter.sendMail({
      from: fromAddr,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html
    });
    logger.info("[Email] sent successfully", { to: params.to });
    return true;
  } catch (err) {
    logger.warn("[Email] send failed", {
      message: err instanceof Error ? err.message : String(err),
      to: params.to
    });
    return false;
  }
}

/** Meta WhatsApp Cloud API (Graph v19). Twilio briefing path: {@link sendWhatsAppStrict}. */
export { sendWhatsAppMessage, WhatsAppMetaRateLimitError } from "./whatsappCloudApiSender";
export type { SendWhatsAppMessageResult } from "./whatsappCloudApiSender";
