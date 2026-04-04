"use client";

/**
 * Pure HTML/CSS “charts” for Analytics — no recharts, chart.js, d3, etc.
 */

type Row = Record<string, unknown>;

export function CssColumnBars({
  data,
  xKey,
  yKey,
  height = 260,
  colorA = "#6c63ff",
  colorB = "#00d4aa"
}: {
  data: Row[];
  xKey: string;
  yKey: string;
  height?: number;
  colorA?: string;
  colorB?: string;
}) {
  const max = Math.max(...data.map((r) => Number(r[yKey])), 1);
  return (
    <div className="flex w-full items-end gap-1 px-1" style={{ height }}>
      {data.map((row, i) => {
        const v = Number(row[yKey]);
        const h = max > 0 ? (v / max) * 100 : 0;
        return (
          <div
            key={i}
            className="flex min-w-0 flex-1 flex-col justify-end"
            title={`${String(row[xKey])}: ${v}`}
          >
            <div
              style={{
                height: `${h}%`,
                minHeight: 3,
                background: i % 2 === 0 ? colorA : colorB,
                borderRadius: "6px 6px 0 0"
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function CssHorizontalBars({
  data,
  labelKey,
  valueKey,
  height = 260,
  colorA = "#00d4aa",
  colorB = "#6c63ff"
}: {
  data: Row[];
  labelKey: string;
  valueKey: string;
  height?: number;
  colorA?: string;
  colorB?: string;
}) {
  const max = Math.max(...data.map((r) => Number(r[valueKey])), 1);
  return (
    <div className="flex flex-col justify-center gap-3 py-2" style={{ minHeight: height }}>
      {data.map((row, i) => {
        const v = Number(row[valueKey]);
        const w = max > 0 ? (v / max) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-white/60">{String(row[labelKey])}</span>
            <div className="h-7 flex-1 overflow-hidden rounded-md bg-white/5">
              <div
                style={{
                  width: `${w}%`,
                  height: "100%",
                  background: i % 2 === 0 ? colorA : colorB,
                  borderRadius: 4
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CssSparklineBars({
  data,
  valueKey,
  height = 180,
  color = "#06b6d4"
}: {
  data: Array<{ date?: string; followerCount?: number }>;
  valueKey: string;
  height?: number;
  color?: string;
}) {
  const max = Math.max(...data.map((r) => Number((r as Row)[valueKey])), 1);
  return (
    <div className="flex w-full items-end gap-0.5 px-1" style={{ height }}>
      {data.map((row, i) => {
        const v = Number((row as Row)[valueKey]);
        const h = max > 0 ? (v / max) * 100 : 0;
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col justify-end">
            <div
              style={{
                height: `${h}%`,
                minHeight: 2,
                background: `linear-gradient(180deg, ${color}, ${color}88)`,
                borderRadius: "4px 4px 0 0"
              }}
              title={`${v}`}
            />
          </div>
        );
      })}
    </div>
  );
}
