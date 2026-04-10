import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { authenticate } from "../middleware/authenticate";

export const whatsappRouter = Router();

whatsappRouter.use(authenticate);

/**
 * POST /api/whatsapp/test-connection
 * Sends a test message to the configured phone number via Meta Graph API.
 * Used by the settings page to confirm credentials are valid.
 */
whatsappRouter.post("/test-connection", async (req, res) => {
  const body = z
    .object({
      /** E.164 number to send the test message to (usually the owner's own number) */
      testPhoneNumber: z
        .string()
        .regex(/^\+\d{7,15}$/, "Must be E.164 format, e.g. +919876543210")
    })
    .parse(req.body);

  const phoneId = env.WA_PHONE_NUMBER_ID?.trim();
  const token = env.WA_GRAPH_ACCESS_TOKEN?.trim();

  if (!phoneId || !token) {
    res.status(503).json({
      success: false,
      error: {
        code: "WA_NOT_CONFIGURED",
        message:
          "WA_PHONE_NUMBER_ID and WA_ACCESS_TOKEN must be set in environment variables before testing."
      }
    });
    return;
  }

  const apiVersion = (env.WA_API_VERSION ?? "v19.0").replace(/^\/+/, "").trim() || "v19.0";
  const url = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneId)}/messages`;

  const graphBody = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: body.testPhoneNumber.replace(/\s/g, ""),
    type: "text",
    text: {
      body: "✅ PulseOS WhatsApp connection test successful. Your WhatsApp Business API is configured correctly."
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(graphBody)
    });

    const data = (await response.json()) as {
      messages?: { id?: string }[];
      error?: { code?: number; message?: string; error_data?: { details?: string } };
    };

    if (!response.ok) {
      const code = data.error?.code;
      const detail = data.error?.error_data?.details ?? data.error?.message ?? `HTTP ${response.status}`;

      // Map common error codes to human-readable messages
      const humanMessage: Record<number, string> = {
        190: "Access token is invalid or expired. Generate a new permanent token in Meta Business Manager.",
        100: "Invalid parameter — check your Phone Number ID is correct.",
        131026: "The test number is not registered on WhatsApp.",
        131047: "The 24-hour messaging window has expired for this number.",
        131048: "Spam rate limit hit — wait a few minutes and try again.",
        131056: "Too many messages sent to this number recently.",
        130429: "Meta throughput rate limit — wait a minute and try again."
      };

      logger.warn("[whatsapp test-connection] Graph API error", { code, detail, userId: req.auth?.userId });

      res.status(400).json({
        success: false,
        error: {
          code: `WA_ERROR_${code ?? response.status}`,
          message: (code && humanMessage[code]) ?? detail
        }
      });
      return;
    }

    const messageId = data.messages?.[0]?.id;
    logger.info("[whatsapp test-connection] success", { messageId, userId: req.auth?.userId });

    res.json({
      success: true,
      messageId,
      message: "Test message sent successfully. Check your WhatsApp for the confirmation message."
    });
  } catch (err) {
    logger.error("[whatsapp test-connection] fetch failed", {
      message: err instanceof Error ? err.message : String(err)
    });
    res.status(502).json({
      success: false,
      error: {
        code: "WA_NETWORK_ERROR",
        message: "Could not reach Meta Graph API. Check your internet connection."
      }
    });
  }
});

/**
 * GET /api/whatsapp/status
 * Returns whether WhatsApp credentials are configured (does not make a live API call).
 */
whatsappRouter.get("/status", (_req, res) => {
  const phoneId = env.WA_PHONE_NUMBER_ID?.trim();
  const token = env.WA_GRAPH_ACCESS_TOKEN?.trim();
  const appSecret = (env.WA_APP_SECRET ?? env.META_APP_SECRET ?? "").trim();

  res.json({
    success: true,
    configured: Boolean(phoneId && token),
    hasPhoneNumberId: Boolean(phoneId),
    hasAccessToken: Boolean(token),
    hasAppSecret: Boolean(appSecret),
    webhookVerifyTokenSet: Boolean(env.WEBHOOK_VERIFY_TOKEN?.trim())
  });
});
