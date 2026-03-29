import nodemailer from "nodemailer";
import twilio from "twilio";

function normalizeWhatsAppAddress(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("whatsapp:")) return t;
  return `whatsapp:${t}`;
}

/**
 * Sends a WhatsApp text via Twilio. Returns false on misconfiguration or failure — never throws.
 */
export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();
    const from = process.env.TWILIO_WHATSAPP_FROM?.trim();
    if (!sid || !token || !from) {
      console.log("[WhatsApp] skipped: missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM");
      return false;
    }

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
 * SMTP fallback delivery. Returns false if SMTP is not configured or send fails — never throws.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  try {
    const host = process.env.SMTP_HOST?.trim();
    const portRaw = process.env.SMTP_PORT?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

    if (!host || !user || pass === undefined) {
      console.log("[Email] skipped: missing SMTP_HOST / SMTP_USER / SMTP_PASS");
      return false;
    }

    const port = portRaw ? Number(portRaw) : 587;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    await transporter.sendMail({
      from: user,
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
