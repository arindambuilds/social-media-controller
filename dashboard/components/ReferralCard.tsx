"use client";

import { useMemo, useState } from "react";
import { trackEvent } from "../lib/trackEvent";
import { useI18n } from "../context/i18n-context";

export function ReferralCard({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const refLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/login?ref=${encodeURIComponent(userId)}`;
  }, [userId]);

  const waMessage = refLink
    ? encodeURIComponent(
        t("referral.waMessage", {
          link: refLink
        })
      )
    : "";

  const handleShare = () => {
    if (!refLink) return;
    window.open(`https://wa.me/?text=${waMessage}`, "_blank", "noopener,noreferrer");
    trackEvent("referral_shared", { method: "whatsapp" });
  };

  const handleCopy = async () => {
    if (!refLink || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(refLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent("referral_shared", { method: "copy" });
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-2xl border border-accent-purple/25 bg-accent-purple/10 p-4">
      <p className="mb-1 text-sm font-semibold text-white">{t("referral.title")}</p>
      <p className="mb-3 text-xs text-white/60">{t("referral.subtitle")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center justify-center rounded-xl bg-[#128C7E] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0f745f]"
        >
          {t("referral.whatsappBtn")}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10"
        >
          {copied ? t("referral.copied") : t("referral.copyBtn")}
        </button>
      </div>
    </div>
  );
}
