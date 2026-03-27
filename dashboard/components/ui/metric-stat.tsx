type MetricStatProps = {
  label: string;
  value: string;
  hint?: string;
  trend?: { direction: "up" | "down" | "neutral"; text: string };
  accent?: boolean;
};

export function MetricStat({ label, value, hint, trend, accent }: MetricStatProps) {
  return (
    <div className={`dash-metric ${accent ? "dash-metric--accent" : ""}`}>
      <div className="dash-metric-label">{label}</div>
      <div className="dash-metric-value">{value}</div>
      {hint ? <div className="dash-metric-hint">{hint}</div> : null}
      {trend ? (
        <div className={`dash-metric-trend dash-metric-trend--${trend.direction}`}>{trend.text}</div>
      ) : null}
    </div>
  );
}
