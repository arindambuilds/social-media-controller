export type TrackEventName =
  | "onboarding_completed"
  | "first_session_action"
  | "referral_shared"
  | "upgrade_clicked"
  | "caption_generated"
  | "dm_replied"
  | "post_scheduled";

export function trackEvent(name: TrackEventName, props?: Record<string, unknown>): void {
  try {
    const payload = { event: name, props, ts: Date.now() };
    void fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => {});
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[track]", name, props);
    }
  } catch {
    // Swallow all errors
  }
}

