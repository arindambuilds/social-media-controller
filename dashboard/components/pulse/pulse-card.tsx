import type { HTMLAttributes } from "react";

type PulseCardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "accent" | "mango";
};

export function PulseCard({ className = "", variant = "default", children, ...rest }: PulseCardProps) {
  const base =
    "rounded-2xl border pulse-card-lift bg-surface/95 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm";
  const variants: Record<NonNullable<PulseCardProps["variant"]>, string> = {
    default: "border-subtle",
    accent:
      "border-accent-purple/35 bg-gradient-to-br from-accent-purple/15 via-surface to-surface",
    mango: "border-mango-500/30 bg-gradient-to-br from-mango-500/10 via-surface to-surface"
  };
  return (
    <div className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </div>
  );
}
