/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        /** Primary app background */
        canvas: "#0A0A0F",
        /** Cards / elevated panels */
        surface: "#111118",
        /** Sidebar / navbar strip */
        "nav-bg": "#08080D",
        /** Primary accent — AI / product */
        "accent-purple": "#6C63FF",
        /** Secondary accent — growth / analytics */
        "accent-teal": "#00D4AA",
        /** PulseOS — ocean trust scale */
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
        /** PulseOS — mango CTA (pair with ink/canvas text) */
        mango: {
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706"
        },
        /** PulseOS — mint success / live */
        mint: {
          400: "#5EEAD4",
          500: "#2DD4BF",
          600: "#14B8A6"
        },
        /** PulseOS — coral warmth / soft danger */
        coral: {
          400: "#FB7185",
          500: "#F43F5E"
        },
        danger: "#FF4D6D",
        warning: "#FFB830",
        /** Headings / primary copy */
        ink: "#F0F0FF",
        /** Secondary copy */
        muted: "#8B8BA0",
        /** Matches border subtle — dividers / hairlines */
        line: "#1E1E2E",
        /** Deeper than surface (CSS --bg-subtle) */
        depth: "#0F0F16",
        /** Strong panels / skeleton bases (CSS --panel-strong) */
        "panel-strong": "#16161F"
      },
      borderColor: {
        /** Default subtle border token */
        subtle: "#1E1E2E"
      },
      ringColor: {
        DEFAULT: "#6C63FF"
      },
      boxShadow: {
        glow: "0 0 20px rgba(108, 99, 255, 0.3)",
        teal: "0 0 20px rgba(0, 212, 170, 0.2)"
      },
      fontFamily: {
        sans: ["var(--font-body)", "DM Sans", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Sora", "system-ui", "sans-serif"]
      },
      transitionTimingFunction: {
        "smooth-out": "cubic-bezier(0.22, 1, 0.36, 1)",
        "tap": "cubic-bezier(0.33, 1, 0.68, 1)"
      },
      transitionDuration: {
        250: "250ms",
        320: "320ms"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        /** Border / glow breathing for premium accents */
        pulseGlow: {
          "0%, 100%": {
            boxShadow: "0 0 8px rgba(108, 99, 255, 0.25), 0 0 16px rgba(0, 212, 170, 0.15)"
          },
          "50%": {
            boxShadow: "0 0 20px rgba(108, 99, 255, 0.45), 0 0 28px rgba(0, 212, 170, 0.35)"
          }
        },
        /** PulseOS — soft “heartbeat” for conversation pulse */
        pulseSoft: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.06)", opacity: "1" }
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-3deg)" },
          "75%": { transform: "rotate(3deg)" }
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" }
        },
        confettiPop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "40%": { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "0" }
        }
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-up": "slideUp 0.3s ease-out forwards",
        "pulse-glow": "pulseGlow 2.5s ease-in-out infinite",
        "pulse-soft": "pulseSoft 2.2s ease-in-out infinite",
        wiggle: "wiggle 0.5s ease-in-out",
        shake: "shake 0.45s ease-in-out",
        "confetti-pop": "confettiPop 0.65s ease-out forwards"
      }
    }
  },
  plugins: []
};
