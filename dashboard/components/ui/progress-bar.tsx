type ProgressBarProps = {
  value: number;
  max?: number;
  label?: string;
};

export function ProgressBar({ value, max = 100, label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="dash-progress">
      {label ? <div className="dash-progress-label">{label}</div> : null}
      <div className="dash-progress-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div className="dash-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
