import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Skeleton({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      aria-hidden
      className={cn("rounded-md", className)}
      style={{
        background: "linear-gradient(90deg, #1A1535 25%, rgba(200,169,81,0.08) 50%, #1A1535 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.6s ease-in-out infinite",
        ...style
      }}
    />
  );
}
