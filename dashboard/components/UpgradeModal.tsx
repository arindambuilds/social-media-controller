"use client";

import { trackEvent } from "../lib/trackEvent";
import { useI18n } from "../context/i18n-context";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  usagePct: number;
  estimatedMissedMonthlyRevenue?: number;
  featureName?: string;
}

export function UpgradeModal({
  open,
  onClose,
  usagePct,
  estimatedMissedMonthlyRevenue,
  featureName
}: UpgradeModalProps) {
  const { t } = useI18n();

  if (!open) return null;

  const clampedUsage = Math.max(0, Math.min(usagePct, 100));

  const usageColor =
    clampedUsage >= 90 ? "bg-red-500" : clampedUsage >= 70 ? "bg-amber-500" : "bg-accent-teal";
  const usageLabelColor = clampedUsage >= 90 ? "text-red-400" : "text-amber-400";

  function handleUpgradeClick() {
    trackEvent("upgrade_clicked", { usagePct: clampedUsage, featureName });
    window.location.href = "/settings/billing";
  }

  const title =
    clampedUsage >= 90
      ? t("upgrade.modalTitleLimit")
      : t("upgrade.modalTitleFeature", { feature: featureName ?? "features" });

  const revenueText =
    estimatedMissedMonthlyRevenue && estimatedMissedMonthlyRevenue > 0
      ? t("upgrade.revenueLine", {
          amount: estimatedMissedMonthlyRevenue.toLocaleString("en-IN")
        })
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-[#111118] p-6 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-lg">
            <span role="img" aria-label="limit">
              ⚡
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-base text-white/30 transition-colors hover:text-white/60"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <h2 className="mb-2 text-lg font-bold text-white">{title}</h2>

        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs text-white/50">
            <span>{t("upgrade.usageLabel")}</span>
            <span className={usageLabelColor}>{Math.round(clampedUsage)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full transition-all ${usageColor}`} style={{ width: `${clampedUsage}%` }} />
          </div>
        </div>

        {revenueText ? (
          <p className="mb-4 text-sm text-white/60">
            <span className="font-semibold text-red-400">
              {revenueText}
            </span>
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleUpgradeClick}
          className="mb-2 w-full rounded-xl bg-accent-purple px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#7a72ff]"
        >
          {t("upgrade.ctaPrimary")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 text-sm text-white/40 transition-colors hover:text-white/60"
        >
          {t("upgrade.ctaSecondary")}
        </button>
      </div>
    </div>
  );
}

