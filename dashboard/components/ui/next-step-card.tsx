import Link from "next/link";
import type { ReactNode } from "react";

type NextStepCardProps = {
  href: string;
  title: string;
  description: string;
  cta: string;
  icon?: ReactNode;
};

export function NextStepCard({ href, title, description, cta, icon }: NextStepCardProps) {
  return (
    <Link href={href} className="dash-next-card">
      <div className="dash-next-card-icon" aria-hidden>
        {icon ?? "→"}
      </div>
      <div>
        <div className="dash-next-card-title">{title}</div>
        <p className="dash-next-card-desc">{description}</p>
        <span className="dash-next-card-cta">{cta}</span>
      </div>
    </Link>
  );
}
