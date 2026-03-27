type InsightPulseProps = {
  title: string;
  body: string;
  icon?: string;
};

export function InsightPulse({ title, body, icon = "✦" }: InsightPulseProps) {
  return (
    <div className="dash-insight-pulse" role="status">
      <span className="dash-insight-pulse-icon" aria-hidden>
        {icon}
      </span>
      <div>
        <div className="dash-insight-pulse-title">{title}</div>
        <p className="dash-insight-pulse-body">{body}</p>
      </div>
    </div>
  );
}
