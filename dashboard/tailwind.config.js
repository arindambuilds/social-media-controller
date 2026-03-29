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
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"]
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
        }
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-up": "slideUp 0.3s ease-out forwards",
        "pulse-glow": "pulseGlow 2.5s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
