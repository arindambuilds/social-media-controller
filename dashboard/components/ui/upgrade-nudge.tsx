import Link from "next/link";

type UpgradeNudgeProps = {
  title?: string;
  body?: string;
  ctaLabel?: string;
  href?: string;
};

export function UpgradeNudge({
  title = "Unlock Growth Pro",
  body = "Scheduled posts, competitor benchmarks, and unlimited AI generations — built for creators who scale.",
  ctaLabel = "See plans",
  href = "/insights"
}: UpgradeNudgeProps) {
  return (
    <aside className="dash-upgrade-nudge">
      <div className="dash-upgrade-nudge-glow" aria-hidden />
      <div className="dash-upgrade-nudge-inner">
        <div>
          <p className="dash-upgrade-nudge-title">{title}</p>
          <p className="dash-upgrade-nudge-body">{body}</p>
        </div>
        <Link href={href} className="button button-ghost">
          {ctaLabel}
        </Link>
      </div>
    </aside>
  );
}
