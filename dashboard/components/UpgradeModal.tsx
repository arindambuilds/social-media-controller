'use client';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature?: string;
}

export function UpgradeModal({ open, onClose, feature = "share links" }: UpgradeModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-sm rounded-3xl border border-cyan-500/30 bg-[#13162a] p-8 shadow-2xl shadow-cyan-900/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-px left-1/2 h-px w-32 -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

        <div className="space-y-4 text-center">
          <div className="text-4xl">🔒</div>

          <h2 className="text-xl font-bold text-white">Unlock {feature}</h2>

          <p className="text-sm leading-relaxed text-white/60">
            Share your AI report with your CA, business partner, or WhatsApp groups. Upgrade to{" "}
            <span className="font-semibold text-cyan-400">Starter</span> to unlock share links.
          </p>

          <div className="space-y-1 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-2xl font-bold text-white">
              ₹299<span className="text-sm font-normal text-white/40">/month</span>
            </p>
            <p className="text-xs text-white/40">Less than your Swiggy bill once a month.</p>
          </div>

          <ul className="space-y-2 text-left text-sm text-white/70">
            {[
              "✅ Unlimited share links",
              "✅ 500 AI DM replies/month",
              "✅ Daily briefings",
              "✅ Live Claude preview in settings"
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <button
            onClick={() => {
              window.location.href = "/settings/billing";
            }}
            className="w-full rounded-2xl bg-cyan-500 py-3 text-sm font-bold text-black transition hover:bg-cyan-400"
          >
            Upgrade to Starter — ₹299/mo
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs text-white/30 transition hover:text-white/60"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

