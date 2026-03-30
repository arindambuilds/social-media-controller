'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

interface Point {
  date: string;
  followerCount: number;
}

interface Props {
  points: Point[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const curr = payload[0].payload as Point & { delta: number };
  return (
    <div className="space-y-0.5 rounded-xl border border-cyan-500/20 bg-[#13162a] px-3 py-2 text-xs">
      <p className="text-white/50">{curr.date}</p>
      <p className="font-semibold text-cyan-300">
        {curr.followerCount.toLocaleString("en-IN")} followers
      </p>
      {curr.delta !== 0 && (
        <p className={curr.delta > 0 ? "text-emerald-400" : "text-red-400"}>
          {curr.delta > 0 ? "+" : ""}
          {curr.delta.toLocaleString("en-IN")} today
        </p>
      )}
    </div>
  );
};

export function FollowerGrowthChart({ points }: Props) {
  const data = points.map((p, i, arr) => ({
    ...p,
    date: new Date(p.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    delta: i > 0 ? p.followerCount - arr[i - 1]!.followerCount : 0
  }));

  if (!data.length) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-white/30">
        No follower data yet — connect Instagram to start tracking.
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-xs uppercase tracking-widest text-white/50">
        See how your audience is growing
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toLocaleString("en-IN")}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="followerCount"
            stroke="#06b6d4"
            strokeWidth={2}
            fill="url(#fgGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "#06b6d4", strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </>
  );
}

