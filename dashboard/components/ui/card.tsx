import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../../lib/cn";

type Props = PropsWithChildren<HTMLAttributes<HTMLDivElement>> & {
  accent?: "amber" | "navy" | "blue" | "green" | "teal" | "none";
};

export function Card({ className, children, accent = "none", ...props }: Props) {
  return (
    <div {...props} className={cn("interactive pulse-card card-glow", accent !== "none" && `pulse-card-${accent}`, className)}>
      {children}
    </div>
  );
}
