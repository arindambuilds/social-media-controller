/**
 * PulseOS design tokens — calming base + mango accent.
 * Use with Tailwind classes mapped in tailwind.config.js and CSS variables in globals.css.
 */

export const pulseTheme = {
  /** Brand */
  name: "PulseOS",

  colors: {
    /** Deep ocean / trust — primary surfaces & nav */
    ocean: {
      50: "#E8F4F8",
      100: "#C5E4ED",
      200: "#8FC8D9",
      300: "#5AA8BF",
      400: "#2E8AA5",
      500: "#1B6B82",
      600: "#145566",
      700: "#0F3F4D",
      800: "#0A2E38",
      900: "#061F26"
    },
    /** Teal mint — success, live, healthy automation */
    mint: {
      400: "#5EEAD4",
      500: "#2DD4BF",
      600: "#14B8A6"
    },
    /** Mango — CTAs, celebrations, highlights (pair with dark text for WCAG) */
    mango: {
      400: "#FBBF24",
      500: "#F59E0B",
      600: "#D97706"
    },
    /** Coral — soft alerts & warmth */
    coral: {
      400: "#FB7185",
      500: "#F43F5E"
    },
    /** Neutrals on dark canvas */
    ink: "#F0F4F8",
    muted: "#94A3B8",
    canvas: "#0A0F14",
    surface: "#0F172A",
    elevated: "#152238",
    line: "#1E293B"
  },

  radius: {
    sm: "10px",
    md: "14px",
    lg: "20px",
    xl: "28px",
    pill: "999px"
  },

  spacing: {
    section: "28px",
    cardPad: "20px",
    gridGap: "14px"
  },

  typography: {
    /** DM Sans via next/font — body text */
    fontSans: 'var(--font-body), "DM Sans", system-ui, sans-serif',
    fontDisplay: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
    scale: {
      xs: "0.75rem",
      sm: "0.8125rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      display: "clamp(1.75rem, 4vw, 2.35rem)"
    }
  },

  motion: {
    /** Respect prefers-reduced-motion in components */
    hoverScale: "1.02",
    pressScale: "0.98",
    durationFast: "150ms",
    durationNorm: "220ms",
    easeOut: "cubic-bezier(0.22, 1, 0.36, 1)"
  },

  elevation: {
    sm: "0 8px 24px rgba(0, 0, 0, 0.35)",
    md: "0 16px 40px rgba(0, 0, 0, 0.45)",
    glowMango: "0 0 24px rgba(245, 158, 11, 0.25)",
    glowMint: "0 0 20px rgba(45, 212, 191, 0.2)"
  }
} as const;

/** Semantic usage (for docs & codegen) */
export const pulseColorRoles = {
  primaryCta: "mango-500 on dark — buttons, key actions",
  secondaryCta: "ocean-200 border + mint-400 text — ghost buttons",
  success: "mint-500 — live, sent, ok",
  warning: "mango-400 — schedule, attention",
  danger: "coral-500 — destructive (confirm first)",
  navActive: "mint-400 underline / left rail pill",
  pageBg: "canvas + subtle radial gradients",
  card: "elevated + line border + shadow-sm"
} as const;

export type PulseTheme = typeof pulseTheme;
