import { Button } from "../ui/button";

type Props = {
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  illustration?: "conversations" | "reports" | "billing" | "settings";
};

function Illustration({ type = "conversations" }: { type?: Props["illustration"] }) {
  if (type === "reports") {
    return (
      <svg viewBox="0 0 220 160" className="empty-state-illustration" aria-hidden>
        <rect x="36" y="28" width="112" height="108" rx="18" fill="#FFFFFF" stroke="#0D1B3E" strokeWidth="4" />
        <rect x="56" y="54" width="72" height="10" rx="5" fill="#F0EBE0" />
        <rect x="56" y="74" width="46" height="10" rx="5" fill="#F0EBE0" />
        <rect x="56" y="100" width="16" height="20" rx="6" fill="#C8A951" />
        <rect x="80" y="86" width="16" height="34" rx="6" fill="#D8C183" />
        <rect x="104" y="68" width="16" height="52" rx="6" fill="#0D1B3E" opacity="0.84" />
        <circle cx="164" cy="56" r="20" fill="#C8A951" opacity="0.15" />
        <path d="M164 44v24M152 56h24" stroke="#C8A951" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "billing") {
    return (
      <svg viewBox="0 0 220 160" className="empty-state-illustration" aria-hidden>
        <rect x="34" y="46" width="152" height="88" rx="22" fill="#0D1B3E" />
        <rect x="34" y="64" width="152" height="18" fill="#162447" />
        <rect x="52" y="100" width="62" height="14" rx="7" fill="#C8A951" />
        <circle cx="162" cy="108" r="18" fill="#C8A951" opacity="0.18" />
        <circle cx="162" cy="108" r="10" fill="#C8A951" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 220 160" className="empty-state-illustration" aria-hidden>
      <rect x="48" y="22" width="124" height="116" rx="28" fill="#0D1B3E" opacity="0.08" />
      <rect x="60" y="34" width="100" height="92" rx="24" fill="#FFFFFF" stroke="#0D1B3E" strokeWidth="4" />
      <path d="M82 84h56" stroke="#C8A951" strokeWidth="8" strokeLinecap="round" />
      <path d="M82 62h36" stroke="#F0EBE0" strokeWidth="8" strokeLinecap="round" />
      <circle cx="164" cy="56" r="18" fill="#C8A951" opacity="0.16" />
      <path d="M159 56l4 4 8-8" stroke="#C8A951" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyState({ title, description, ctaLabel, onCta, illustration }: Props) {
  return (
    <div className="empty-state-card">
      <Illustration type={illustration} />
      <h3>{title}</h3>
      <p>{description}</p>
      {ctaLabel && onCta ? (
        <Button variant="primary" onClick={onCta}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}
