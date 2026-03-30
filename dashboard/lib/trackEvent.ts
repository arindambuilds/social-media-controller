import { trackEvent as trackAnalyticsEvent } from "../utils/analytics";

export type TrackEventName =
  | "onboarding_completed"
  | "first_session_action"
  | "referral_shared"
  | "upgrade_clicked"
  | "upgrade_click"
  | "caption_generated"
  | "dm_replied"
  | "post_scheduled"
  | "paywall_impression"
  | "checkout_started"
  | "billing_page_view"
  | "payment_success"
  | "page_view_pricing"
  | "plan_selected"
  | "experiment_assigned"
  | "experiment_conversion"
  | "paywall_variant_shown"
  | "checkout_abandoned";

export function trackEvent(name: TrackEventName, props?: Record<string, unknown>): void {
  void trackAnalyticsEvent(name, { metadata: props });
}

