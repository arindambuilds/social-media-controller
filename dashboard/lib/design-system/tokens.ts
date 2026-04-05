// PulseOS Design System — Dark Theme Token Reference
// These complement the CSS variables in globals.css.
// Use these in component logic where CSS vars are inconvenient.

export const colors = {
  bg: {
    primary: "#0D0B1F",
    secondary: "#130F2E",
    card: "#1A1535"
  },
  accent: {
    cyan: "#00E5FF",
    cyanSoft: "#22D3EE",
    pink: "#FF6B9D",
    pinkSoft: "#F472B6",
    purple: "#8B5CF6",
    purpleSoft: "#A78BFA",
    amber: "#C8A951"
  },
  glow: {
    cyan: "rgba(0, 229, 255, 0.15)",
    pink: "rgba(255, 107, 157, 0.15)",
    purple: "rgba(139, 92, 246, 0.2)"
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#A0A0C0",
    muted: "#7D7DA7"
  },
  semantic: {
    success: "#22D3EE",
    warning: "#C8A951",
    danger: "#FF6B9D",
    info: "#8B5CF6"
  }
} as const;

export const spacing = {
  px: "1px",
  0: "0px",
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
  24: "96px"
} as const;

export const radius = {
  none: "0px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "24px",
  full: "9999px"
} as const;

export const shadow = {
  none: "none",
  cyan: "0 0 20px rgba(0, 229, 255, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
  pink: "0 0 20px rgba(255, 107, 157, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
  purple: "0 0 20px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
  card: "0 4px 24px rgba(0, 0, 0, 0.4)",
  amber: "0 4px 20px rgba(200, 169, 81, 0.25)"
} as const;

export const motion = {
  ease: {
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
    enter: "cubic-bezier(0, 0, 0.2, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
    precise: "cubic-bezier(0.2, 0, 0, 1)"
  },
  duration: {
    instant: 80,
    fast: 150,
    base: 220,
    slow: 350,
    reveal: 500
  }
} as const;

export const zIndex = {
  hide: -1,
  base: 0,
  raised: 10,
  dropdown: 20,
  sticky: 30,
  overlay: 40,
  modal: 50,
  toast: 60
} as const;
