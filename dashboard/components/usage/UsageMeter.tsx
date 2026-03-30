"use client";

interface Props {
  label: string;
  description: string;
  used: number;
  limit: number | null;
  unit: string;
  icon: string;
}

function barColor(pct: number) {
  if (pct >= 90) return "bg-red-400";
  if (pct >= 70) return "bg-amber-400";
  return "bg-cyan-400";
}

function barBg(pct: number) {
  if (pct >= 90) return "bg-red-400/15";
  if (pct >= 70) return "bg-amber-400/15";
  return "bg-white/8";
}

export function UsageMeter({ label, description, used, limit, unit, icon }: Props) {
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const remaining = isUnlimited ? null : Math.max(limit - used, 0);

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{icon}</span>
          <div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-white/35">{description}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold leading-none text-white">{used.toLocaleString("en-IN")}</p>
          <p className="mt-0.5 text-xs text-white/35">
            {isUnlimited ? "unlimited" : `of ${limit.toLocaleString("en-IN")} ${unit}`}
          </p>
        </div>
      </div>

      {!isUnlimited && (
        <div className={`h-2 overflow-hidden rounded-full ${barBg(pct)}`}>
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        {isUnlimited ? (
          <span className="font-medium text-emerald-400">✓ Unlimited on your plan</span>
        ) : (
          <>
            <span
              className={
                pct >= 90 ? "font-medium text-red-400" : pct >= 70 ? "font-medium text-amber-400" : "text-white/35"
              }
            >
              {pct >= 90 ? `⚠️ Only ${remaining} ${unit} remaining` : `${remaining} ${unit} remaining`}
            </span>
            <span className="text-white/25">{pct.toFixed(0)}% used</span>
          </>
        )}
      </div>
    </div>
  );
}
