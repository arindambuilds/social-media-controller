"use client";

import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type Props = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Replaces label with animated checkmark + “Done! ✓” (primary CTA success). */
  success?: boolean;
  fullWidth?: boolean;
};

export function Button({
  className,
  children,
  variant = "primary",
  size = "md",
  loading = false,
  success = false,
  fullWidth = false,
  disabled,
  ...props
}: Props) {
  const busy = loading && !success;
  const showSpinner = busy;

  return (
    <button
      {...props}
      disabled={disabled || busy || success}
      aria-busy={busy || undefined}
      className={cn(
        "interactive pulse-button",
        `pulse-button-${variant}`,
        `pulse-button-${size}`,
        fullWidth && "pulse-button-full",
        success && variant === "primary" && "pulse-button-success-state",
        className
      )}
    >
      {success && variant === "primary" ? (
        <span className="pulse-button-success-inner">
          <svg className="pulse-button-success-svg" viewBox="0 0 24 24" aria-hidden>
            <path
              className="pulse-button-success-path"
              d="M6 12 L11 17 L18 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Done! ✓</span>
        </span>
      ) : (
        <>
          <span className={cn("pulse-button-content", showSpinner && "is-loading")}>{children}</span>
          {showSpinner ? <span className="amber-spinner" aria-hidden /> : null}
        </>
      )}
    </button>
  );
}
