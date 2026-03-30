"use client";

import { useState } from "react";
import { trackEvent } from "../lib/trackEvent";
import { useI18n } from "../context/i18n-context";

interface ShareGrowthCardProps {
  followerDelta: number;
  reachPct: number;
  businessName: string;
}

export function ShareGrowthCard({ followerDelta, reachPct, businessName }: ShareGrowthCardProps) {
  const { t } = useI18n();
  const [shared, setShared] = useState(false);

  if (followerDelta <= 0 && reachPct <= 0) return null;

  const shareText = t("shareGrowth.text", {
    businessName,
    followers: followerDelta > 0 ? `+${followerDelta}` : String(followerDelta),
    reachPct: reachPct.toFixed(0)
  });

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      }
      trackEvent("referral_shared", { method: "share_growth" });
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-accent-teal/25 bg-accent-teal/10 p-4">
      <div>
        <p className="mb-0.5 text-xs font-semibold text-accent-teal">{t("shareGrowth.label")}</p>
        <p className="text-sm font-bold text-white">
          {followerDelta > 0 ? `+${followerDelta}` : followerDelta} followers ·{" "}
          {reachPct > 0 ? "+" : ""}
          {reachPct.toFixed(0)}% reach
        </p>
      </div>
      <button
        type="button"
        onClick={handleShare}
        className="shrink-0 rounded-xl bg-accent-teal px-4 py-2 text-xs font-bold text-[#0A0A0F] transition-colors hover:bg-[#00b894]"
      >
        {shared ? t("shareGrowth.copied") : t("shareGrowth.shareBtn")}
      </button>
    </div>
  );
}

