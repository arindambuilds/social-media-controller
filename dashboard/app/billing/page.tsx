"use client";

import { Bolt, Download } from "lucide-react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageTransition } from "../../components/layout/PageTransition";
import { StaggerContainer, StaggerItem } from "../../components/layout/StaggerContainer";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../context/toast-context";
import { usePageEnter } from "../../hooks/usePageEnter";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useProtectedRoute } from "../../hooks/useProtectedRoute";
import { formatCurrency, formatPlanLabel } from "../../lib/pulse";
import { trackEvent } from "../../lib/trackEvent";
import { AgencyUsage, BillingStatus, getAgencyUsage, getBillingStatus } from "../../lib/workspace";

const CURRENT_PLAN_PRICES: Record<string, number> = {
  free: 0,
  starter: 1499,
  growth: 2999,
  agency: 5999,
  pro: 5999,
  pioneer: 600
};

const PIONEER_PLAN = {
  id: "pioneer",
  name: "Pioneer",
  price: 600,
  features: [
    "Razorpay-powered checkout for India-first billing",
    "Priority automation credits for launch customers",
    "Founding pricing designed for Odisha MSMEs",
    "Fast manual support while self-serve billing evolves"
  ]
} as const;
const MOCK_BILLING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_MOCK_BILLING === "true";
const MOCK_LOCAL_SIGNATURE = "mock_local_signature";

type CheckoutSessionResponse = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
};

type VerifyPaymentResponse = {
  success?: boolean;
  error?: string;
  paymentId?: string;
  orderId?: string;
};

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error?: {
    description?: string;
  };
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  prefill?: {
    email?: string;
    name?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
};

type RazorpayInstance = {
  open: () => void;
  on?: (event: string, handler: (response: RazorpayFailureResponse) => void) => void;
};

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

type RazorpayWindow = Window & {
  Razorpay?: RazorpayConstructor;
};

function buildMockPaymentResponse(): RazorpaySuccessResponse {
  const stamp = Date.now();
  return {
    razorpay_order_id: `mock_order_${stamp}`,
    razorpay_payment_id: `mock_payment_${stamp}`,
    razorpay_signature: MOCK_LOCAL_SIGNATURE
  };
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  return fallback;
}

async function readJson<T>(response: Response): Promise<T | Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

export default function BillingPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, user, isReady, isAuthenticated, refreshUser } = useProtectedRoute();
  const toast = useToast();
  const pageClassName = usePageEnter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const verifyingPaymentRef = useRef(false);
  const [usage, setUsage] = useState<AgencyUsage | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);

  usePageTitle("Billing");

  const checkoutSource = useMemo(
    () => searchParams?.get("source")?.trim() || "billing_page",
    [searchParams]
  );
  const checkoutFeature = useMemo(
    () => searchParams?.get("feature")?.trim() || "pioneer_plan",
    [searchParams]
  );

  const loadBilling = useCallback(async () => {
    if (!user?.clientId) {
      setLoading(false);
      return;
    }
    try {
      const [usageData, billingData] = await Promise.all([
        getAgencyUsage(),
        getBillingStatus(user.clientId).catch(() => null)
      ]);
      setUsage(usageData);
      setBillingStatus(billingData);
      setLoadError(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Couldn’t load billing.";
      setLoadError(detail);
      toast.error("Something went sideways — let’s try again", detail);
    } finally {
      setLoading(false);
    }
  }, [toast, user?.clientId]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    void loadBilling();
  }, [isAuthenticated, isReady, loadBilling]);

  useEffect(() => {
    if (searchParams?.get("manage") !== "1") return;
    toast.info(
      "Manage your plan",
      "Use the Pioneer billing section below while self-serve plan management is being finalized."
    );
  }, [searchParams, toast]);

  const rawPlan = (usage?.plan ?? user?.plan ?? "starter").toLowerCase();
  const planLabel = ["pioneer", "pro", "growth"].includes(rawPlan)
    ? rawPlan
    : rawPlan === "free"
      ? "Free"
      : rawPlan;
  const currentPlan = planLabel.toLowerCase();
  const currentPlanName = planLabel === "Free" ? "Free" : formatPlanLabel(currentPlan);
  const isPioneerPlan = currentPlan === PIONEER_PLAN.id;
  const actionLabel = MOCK_BILLING_ENABLED
    ? "Complete local test checkout"
    : razorpayReady
      ? "Upgrade with Razorpay"
      : "Loading Razorpay checkout...";
  const usagePercent = useMemo(() => {
    if (!billingStatus || billingStatus.generationsLimit <= 0) return 0;
    return Math.min(100, Math.round((billingStatus.generationsUsed / billingStatus.generationsLimit) * 100));
  }, [billingStatus]);
  const currentPlanPrice = CURRENT_PLAN_PRICES[currentPlan] ?? CURRENT_PLAN_PRICES.starter;

  async function verifyPayment(response: RazorpaySuccessResponse) {
    try {
      if (!token) {
        throw new Error("Please sign in again before verifying your payment.");
      }

      verifyingPaymentRef.current = true;
      setVerifyingPayment(true);
      const verificationResponse = await fetch("/api/verify-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planId: PIONEER_PLAN.id,
          source: checkoutSource,
          feature: checkoutFeature,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        })
      });
      const verificationPayload = await readJson<VerifyPaymentResponse>(verificationResponse);
      if (!verificationResponse.ok) {
        throw new Error(readErrorMessage(verificationPayload, "Payment succeeded, but plan activation failed."));
      }

      await refreshUser();
      window.location.href = `/success?razorpay_payment_id=${encodeURIComponent(response.razorpay_payment_id)}&razorpay_order_id=${encodeURIComponent(response.razorpay_order_id)}`;
    } catch (error) {
      toast.error(
        "Payment captured but activation needs attention",
        error instanceof Error ? error.message : "Couldn’t activate the Pioneer plan after payment."
      );
      setCheckoutPlan(null);
      verifyingPaymentRef.current = false;
      setVerifyingPayment(false);
    }
  }

  async function handleCheckout() {
    if (checkoutPlan || isPioneerPlan) return;
    if (!token) {
      toast.info("Please sign in again", "We need an active session before opening Razorpay.");
      return;
    }
    if (MOCK_BILLING_ENABLED) {
      const confirmed = window.confirm(
        "Local mock billing is enabled. This will simulate a successful Pioneer payment and activate the plan through the local API. Continue?"
      );
      if (!confirmed) return;

      setCheckoutPlan(PIONEER_PLAN.id);
      verifyingPaymentRef.current = false;
      setVerifyingPayment(false);

      try {
        trackEvent("upgrade_click", {
          source: checkoutSource,
          feature: checkoutFeature,
          plan: PIONEER_PLAN.id
        });
        trackEvent("checkout_started", {
          source: checkoutSource,
          feature: checkoutFeature,
          plan: PIONEER_PLAN.id,
          amount: PIONEER_PLAN.price
        });
        toast.info("Local mock checkout", "Skipping Razorpay and simulating a successful Pioneer payment.");
        await verifyPayment(buildMockPaymentResponse());
      } catch (error) {
        toast.error(
          "Something went sideways — let’s try again",
          error instanceof Error ? error.message : "Couldn’t complete the mocked Pioneer checkout."
        );
        setCheckoutPlan(null);
        verifyingPaymentRef.current = false;
        setVerifyingPayment(false);
      }
      return;
    }

    const RazorpayCtor = (window as RazorpayWindow).Razorpay;
    if (!RazorpayCtor || !razorpayReady) {
      toast.info("Checkout is still loading", "Razorpay is warming up. Try again in a moment.");
      return;
    }

    setCheckoutPlan(PIONEER_PLAN.id);
    verifyingPaymentRef.current = false;
    setVerifyingPayment(false);

    try {
      trackEvent("upgrade_click", {
        source: checkoutSource,
        feature: checkoutFeature,
        plan: PIONEER_PLAN.id
      });

      const checkoutResponse = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planId: PIONEER_PLAN.id,
          source: checkoutSource,
          feature: checkoutFeature
        })
      });
      const checkoutPayload = await readJson<CheckoutSessionResponse>(checkoutResponse);
      if (!checkoutResponse.ok) {
        throw new Error(readErrorMessage(checkoutPayload, "Couldn’t start Razorpay checkout."));
      }

      const { orderId, amount, currency, keyId } = checkoutPayload as CheckoutSessionResponse;
      if (!keyId) {
        throw new Error("Razorpay key id is missing. Set RAZORPAY_KEY_ID on Vercel.");
      }

      trackEvent("checkout_started", {
        source: checkoutSource,
        feature: checkoutFeature,
        plan: PIONEER_PLAN.id,
        amount: amount / 100
      });

      const razorpay = new RazorpayCtor({
        key: keyId,
        amount,
        currency,
        name: "PulseOS",
        description: "Pioneer Plan ₹600/mo",
        order_id: orderId,
        handler: (response) => {
          void verifyPayment(response);
        },
        prefill: {
          email: user?.email ?? undefined,
          name: user?.name ?? undefined
        },
        notes: {
          planId: PIONEER_PLAN.id,
          source: checkoutSource,
          feature: checkoutFeature
        },
        theme: { color: "#C8A951" },
        modal: {
          ondismiss: () => {
            if (verifyingPaymentRef.current) return;
            setCheckoutPlan(null);
            trackEvent("checkout_abandoned", {
              source: checkoutSource,
              feature: checkoutFeature,
              plan: PIONEER_PLAN.id
            });
            toast.info("Checkout closed", "You can restart the Pioneer plan upgrade whenever you're ready.");
          }
        }
      });

      razorpay.on?.("payment.failed", (event) => {
        setCheckoutPlan(null);
        verifyingPaymentRef.current = false;
        setVerifyingPayment(false);
        toast.error(
          "Payment failed",
          event.error?.description ?? "Razorpay couldn’t complete the payment. Please try again."
        );
      });

      razorpay.open();
    } catch (error) {
      toast.error(
        "Something went sideways — let’s try again",
        error instanceof Error ? error.message : "Couldn’t open Razorpay checkout."
      );
      setCheckoutPlan(null);
      verifyingPaymentRef.current = false;
      setVerifyingPayment(false);
    } finally {
      /* modal handles reset on dismiss/success/failure */
    }
  }

  return (
    <>
      {MOCK_BILLING_ENABLED ? null : (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
          onLoad={() => setRazorpayReady(true)}
          onError={() => {
            setRazorpayReady(false);
            toast.error("Checkout script failed", "Razorpay checkout didn’t load. Please refresh and try again.");
          }}
        />
      )}
      <PageTransition>
        <section key={pathname} className={`page-section overview-grid ${pageClassName} px-4 md:px-6 lg:px-8`}>
          {loading ? (
            <Skeleton className="h-[240px]" />
          ) : loadError && !usage && !billingStatus ? (
            <Card className="section-card">
              <ErrorState message="Couldn’t load billing" detail={loadError} onRetry={() => void loadBilling()} />
            </Card>
          ) : (
            <Card className="section-card billing-current-card">
              <div className="section-heading" style={{ marginBottom: 16 }}>
                <div>
                  <p
                    style={{
                      margin: 0,
                      color: "rgba(255,255,255,0.75)",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em"
                    }}
                  >
                    Current plan
                  </p>
                  <h2 className="gradient-text" style={{ fontSize: "2rem", marginBottom: 8 }}>
                    {currentPlanName} Plan
                  </h2>
                  <p>
                    {isPioneerPlan
                      ? "Razorpay verification is active for this workspace."
                      : MOCK_BILLING_ENABLED
                        ? "Local mock checkout is enabled for customer-flow testing."
                        : "Launch pricing is available through the Pioneer plan checkout."}
                  </p>
                </div>
                <Badge tone={isPioneerPlan ? "green" : "soft"}>
                  {isPioneerPlan ? "Razorpay Active" : MOCK_BILLING_ENABLED ? "Local Mock Enabled" : "Razorpay Ready"}
                </Badge>
              </div>
              <p style={{ marginTop: 18, fontSize: "2rem", fontFamily: "var(--font-display)", fontWeight: 800 }}>
                {formatCurrency(currentPlanPrice)}
                <span style={{ fontSize: "1rem", fontWeight: 500 }}>/month</span>
              </p>
              <p style={{ marginTop: 10 }}>Automation credits this month</p>
              <div className="usage-track">
                <div className="usage-fill" style={{ width: `${usagePercent}%` }} />
              </div>
              <p style={{ marginTop: 10 }}>
                {billingStatus
                  ? `${billingStatus.generationsUsed} / ${billingStatus.generationsLimit} automations used`
                  : "Usage updates will appear here shortly."}
              </p>
            </Card>
          )}

          <StaggerContainer className="billing-plan-grid">
            <StaggerItem className="billing-plan-pro-wrap">
              <span className="billing-plan-ribbon" aria-hidden>
                India launch offer
              </span>
              <Card className="billing-plan-card current pro">
                <div className="section-heading" style={{ marginBottom: 12 }}>
                  <div>
                    <h3>{PIONEER_PLAN.name}</h3>
                    <p style={{ marginTop: 6 }}>{formatCurrency(PIONEER_PLAN.price)}/month</p>
                  </div>
                  <Badge tone="amber">₹600/mo</Badge>
                </div>
                <ul>
                  {PIONEER_PLAN.features.map((feature) => (
                    <li key={feature} style={{ marginBottom: 10 }}>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 18 }}>
                  {isPioneerPlan ? (
                    <Button variant="ghost" size="lg" fullWidth>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className="upgrade-btn"
                      variant="primary"
                      size="lg"
                      fullWidth
                      loading={checkoutPlan === PIONEER_PLAN.id || verifyingPayment}
                      onClick={handleCheckout}
                    >
                      {actionLabel}
                    </Button>
                  )}
                </div>
                {MOCK_BILLING_ENABLED ? (
                  <div className="info-banner" style={{ marginTop: 14 }}>
                    Local mock billing is enabled. This simulates a successful payment and redirects to the success page
                    without opening the Razorpay modal.
                  </div>
                ) : null}
                <p style={{ marginTop: 14, color: "rgba(255,255,255,0.65)" }}>
                  {MOCK_BILLING_ENABLED
                    ? "Use real Razorpay test keys in dashboard/.env.local to switch from the mock customer flow to the live Razorpay sandbox."
                    : "No external redirect. Payment happens inside the secure Razorpay modal and activates your plan immediately after verification."}
                </p>
              </Card>
            </StaggerItem>
          </StaggerContainer>

          <Card className="section-card">
            <div className="section-heading" style={{ marginBottom: 16 }}>
              <div>
                <h3 className="gradient-text">Billing History</h3>
                <p>Receipts will appear here after the first Razorpay payment is captured and verified.</p>
              </div>
              <Badge tone="soft">{isPioneerPlan ? "Active plan" : "Awaiting first payment"}</Badge>
            </div>
            <table className="billing-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td>{formatCurrency(PIONEER_PLAN.price)}</td>
                  <td>
                    <Badge tone={isPioneerPlan ? "green" : "soft"}>{isPioneerPlan ? "Verified" : "Pending"}</Badge>
                  </td>
                  <td>
                    <span className="link-arrow">
                      <Download size={14} aria-hidden /> Razorpay receipt after first successful charge
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="info-banner" style={{ marginTop: 18 }}>
              <Bolt size={16} style={{ marginRight: 8 }} /> Founder-friendly Pioneer pricing goes through Razorpay and
              activates the plan right after signature verification.
            </div>
          </Card>
        </section>
      </PageTransition>
    </>
  );
}

