"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { cn } from "../../lib/cn";

type Props = {
  size?: number;
  alt?: string;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ size = 48, alt = "PulseOS", className, priority = false }: Props) {
  const [failed, setFailed] = useState(false);
  const gradientId = useId().replace(/:/g, "");

  if (!failed) {
    return (
      <Image
        src="/logo.png"
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        className={cn("brand-logo-image", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={cn("brand-logo-fallback", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={alt}
    >
      <svg viewBox="0 0 96 96" width={size} height={size} className="brand-logo-svg" aria-hidden>
        <defs>
          <linearGradient id={`${gradientId}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#130F2E" />
            <stop offset="100%" stopColor="#0D0B1F" />
          </linearGradient>
          <linearGradient id={`${gradientId}-text`} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="52%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#FF6B9D" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="88" height="88" rx="24" fill={`url(#${gradientId}-bg)`} />
        <rect x="4" y="4" width="88" height="88" rx="24" fill="none" stroke="rgba(139, 92, 246, 0.45)" />
        <circle cx="48" cy="48" r="28" fill="rgba(0, 229, 255, 0.08)" />
        <path
          d="M24 24 L38 24 M58 24 L72 24 M24 72 L38 72 M58 72 L72 72 M24 24 L24 38 M24 58 L24 72 M72 24 L72 38 M72 58 L72 72"
          stroke="rgba(0, 229, 255, 0.6)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="24" cy="24" r="4" fill="#00E5FF" />
        <circle cx="72" cy="24" r="4" fill="#FF6B9D" />
        <circle cx="24" cy="72" r="4" fill="#8B5CF6" />
        <circle cx="72" cy="72" r="4" fill="#00E5FF" />
        <text
          x="50%"
          y="57%"
          textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="38"
          fontWeight="800"
          fill={`url(#${gradientId}-text)`}
        >
          P
        </text>
      </svg>
    </div>
  );
}
