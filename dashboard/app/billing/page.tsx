"use client";

import { Bolt, CreditCard, Download } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../context/toast-context";
import { usePageEnter } from "../../hooks/usePageEnter";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useProtectedRoute } from "../../hooks/useProtectedRoute";
import { formatCurrency, formatPlanLabel } from "../../lib/pulse";
import { AgencyUsage, BillingStatus, getAgencyUsage, getBillingStatus, openBillingPortal, startCheckout } from "../../lib/workspace";

const PLANS: Array<{
  id: "starter" | "growth" | "agency";
  name: string;
  price: number;
  features: string[];
  pro?: boolean;
}> = [
  { id: "starter", name: "Starter", price: 1499, features: ["Up to 1 workspace", "Warm support", "PDF reports", "Smart reply automation"] },
  { id: "growth", name: "Growth", price: 2999, features: ["More automations", "Faster reporting", "Priority support", "Richer insights"] },
  { id: "agency", name: "Pro", price: 5999, features: ["Multi-brand scale", "Unlimited reporting", "Priority onboarding", "Hands-on support"], pro: true }
];

export default function BillingPage() {
  const pathname = usePathname();
  const { user, isReady, isAuthenticated } = useProtectedRoute();
  const toast = useToast();
  const pageClassName = usePageEnter();
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [usage, setUsage] = useState<AgencyUsage | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);

  usePageTitle("Billing");

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
    } catch (error) {
      toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t load billing.");
    } finally {
      setLoading(false);
    }
  }, [toast, user?.clientId]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    void loadBilling();
  }, [isAuthenticated, isReady, loadBilling]);

  const currentPlan = usage?.plan ?? (user?.plan ?? "starter");
  const usagePercent = useMemo(() => {
    if (!billingStatus || billingStatus.generationsLimit <= 0) return 0;
    return Math.min(100, Math.round((billingStatus.generationsUsed / billingStatus.generationsLimit) * 100));
  }, [billingStatus]);

  async function handleUpgrade(planId: "starter" | "growth" | "agency") {
    if (checkoutPlan) return;
    setCheckoutPlan(planId);
    try {
      const response = await startCheckout(planId);
      if (response.url) {
        window.location.href = response.url;
        return;
      }
      toast.info("Checkout is almost ready", "Stripe is still warming up on this environment.");
    } catch (error) {
      toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t start checkout.");
    } finally {
      setCheckoutPlan(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const response = await openBillingPortal();
      if (response.url) {
        window.location.href = response.url;
        return;
      }
      toast.info("Portal isn’t ready yet", "We’ll bring billing self-serve tools here soon.");
    } catch (error) {
      toast.error("Something went sideways — let’s try again", error instanceof Error ? error.message : "Couldn’t open the billing portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <section key={pathname} className={`page-section overview-grid ${pageClassName}`}>
      {loading ? (
        <Skeleton className="h-[240px]" />
      ) : (
        <Card className="section-card billing-current-card">
          <div className="section-heading">
            <div>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Current plan</p>
              <h2 style={{ color: "var(--amber)", fontSize: "2rem", marginBottom: 8 }}>{formatPlanLabel(currentPlan)} Plan</h2>
              <p>Renews on {new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <Button variant="ghost" size="lg" loading={portalLoading} onClick={handlePortal}>Manage billing</Button>
          </div>
          <p style={{ marginTop: 18, fontSize: "2rem", fontFamily: "var(--font-display)", fontWeight: 800 }}>{formatCurrency(PLANS.find((plan) => plan.id === currentPlan)?.price ?? 1499)}<span style={{ fontSize: "1rem", fontWeight: 500 }}>/month</span></p>
          <p style={{ marginTop: 10 }}>Automation credits this month</p>
          <div className="usage-track">
            <div className="usage-fill" style={{ width: `${usagePercent}%` }} />
          </div>
          <p style={{ marginTop: 10 }}>{billingStatus ? `${billingStatus.generationsUsed} / ${billingStatus.generationsLimit} automations used` : "Usage updates will appear here shortly."}</p>
        </Card>
      )}

      <div className="billing-plan-grid">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const card = (
            <Card className={`billing-plan-card ${isCurrent ? "current" : ""} ${plan.pro ? "pro" : ""}`}>
              <div className="section-heading" style={{ marginBottom: 12 }}>
                <div>
                  <h3>{plan.name}</h3>
                  <p style={{ marginTop: 6 }}>{formatCurrency(plan.price)}/month</p>
                </div>
                {isCurrent ? <Badge tone="amber">Current Plan</Badge> : null}
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature} style={{ marginBottom: 10 }}>{feature}</li>
                ))}
              </ul>
              <div style={{ marginTop: 18 }}>
                {isCurrent ? (
                  <Button variant="ghost" size="lg" fullWidth>Current Plan</Button>
                ) : (
                  <Button className="upgrade-btn" variant="primary" size="lg" fullWidth loading={checkoutPlan === plan.id} onClick={() => handleUpgrade(plan.id)}>
                    Upgrade
                  </Button>
                )}
              </div>
            </Card>
          );
          if (plan.pro) {
            return (
              <div key={plan.id} className="billing-plan-pro-wrap">
                <span className="billing-plan-ribbon" aria-hidden>
                  Most Popular
                </span>
                {card}
              </div>
            );
          }
          return <div key={plan.id}>{card}</div>;
        })}
      </div>

      <Card className="section-card">
        <div className="section-heading">
          <div>
            <h3>Billing History</h3>
            <p>Clean, simple, and easy to forward to your accountant.</p>
          </div>
          <Badge tone="soft">1 invoice</Badge>
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
              <td>{formatCurrency(PLANS.find((plan) => plan.id === currentPlan)?.price ?? 1499)}</td>
              <td><Badge tone="green">Paid</Badge></td>
              <td><span className="link-arrow"><Download size={14} aria-hidden /> Download PDF ↓</span></td>
            </tr>
          </tbody>
        </table>
        <div className="info-banner" style={{ marginTop: 18 }}>
          <Bolt size={16} style={{ marginRight: 8 }} /> Upgrade when you’re ready — no surprises, no complicated billing maze.
        </div>
      </Card>
    </section>
  );
}

