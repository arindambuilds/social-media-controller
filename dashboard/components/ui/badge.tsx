import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../../lib/cn";

type BadgeTone = "amber" | "green" | "blue" | "red" | "navy" | "soft";

type Props = PropsWithChildren<HTMLAttributes<HTMLSpanElement>> & {
  tone?: BadgeTone;
};

export function Badge({ className, children, tone = "soft", ...props }: Props) {
  return (
    <span {...props} className={cn("pulse-badge", `pulse-badge-${tone}`, className)}>
      {children}
    </span>
  );
}
