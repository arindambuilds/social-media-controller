import { env } from "../config/env";

/**
 * Sends an Instagram DM via the Messenger-compatible Graph API (page access token).
 * Never throws; logs errors and returns false on failure.
 */
export async function sendInstagramDm(
  recipientIgId: string,
  message: string,
  pageAccessToken: string
): Promise<boolean> {
  if (env.INSTAGRAM_MOCK_MODE === true) {
    console.log("[DM Mock] Would send to", recipientIgId, ":", message);
    return true;
  }

  const token = pageAccessToken?.trim();
  if (!token) {
    console.log("[instagramSender] skipped: empty page access token");
    return false;
  }

  try {
    const url = "https://graph.facebook.com/v18.0/me/messages";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        recipient: { id: recipientIgId },
        message: { text: message }
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.log("[instagramSender] Graph API error", res.status, errText.slice(0, 500));
      return false;
    }

    return true;
  } catch (err) {
    console.log("[instagramSender] request failed:", err instanceof Error ? err.message : String(err));
    return false;
  }
}
