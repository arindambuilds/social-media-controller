import nodemailer from "nodemailer";
import twilio from "twilio";

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
export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  try {
    if (!twilioConfigured()) {
      console.log("WhatsApp skipped: Twilio not configured");
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
    console.log("[WhatsApp] sent successfully to", toAddr);
    return true;
  } catch (err) {
    console.log("[WhatsApp] send failed:", err instanceof Error ? err.message : String(err));
    return false;
  }
}

/**
 * Plain-text email. Returns false if SMTP is not configured or send fails — never throws.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  try {
    if (!smtpConfigured()) {
      console.log("Email skipped: SMTP not configured");
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
    console.log("[Email] sent successfully to", to);
    return true;
  } catch (err) {
    console.log("[Email] send failed:", err instanceof Error ? err.message : String(err));
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
      console.log("Email skipped: SMTP not configured");
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
    console.log("[Email] sent successfully to", params.to);
    return true;
  } catch (err) {
    console.log("[Email] send failed:", err instanceof Error ? err.message : String(err));
    return false;
  }
}
