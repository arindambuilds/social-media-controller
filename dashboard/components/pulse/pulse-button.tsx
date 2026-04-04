import type { ButtonHTMLAttributes } from "react";

type PulseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function PulseButton({
  className = "",
  variant = "primary",
  children,
  ...rest
}: PulseButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-[transform,box-shadow,background-color,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50 motion-safe:active:scale-[0.98]";
  const variants: Record<NonNullable<PulseButtonProps["variant"]>, string> = {
    primary:
      "bg-gradient-to-r from-mango-500 to-mango-600 text-canvas shadow-[0_8px_24px_rgba(245,158,11,0.35)] hover:brightness-110 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]",
    secondary:
      "border border-subtle bg-surface text-ink hover:border-mint-500/40 hover:text-mint-400 motion-safe:hover:scale-[1.01] motion-safe:active:scale-[0.99]",
    ghost:
      "border border-transparent bg-transparent text-mango-400 hover:bg-mango-500/10 motion-safe:hover:scale-[1.01]"
  };
  return (
    <button type="button" className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
