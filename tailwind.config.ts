import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // BEUR SEASON brand palette
        ink: "#000000",        // Black — header, logo, CTA
        charcoal: "#464646",   // body text, icons
        "gold-dark": "#b29560", // page background
        gold: "#c9a96e",        // Warm Gold — buttons, links, accent
        sand: "#e0cca7",        // card / content surface
        paper: "#ffffff",       // pure white
      },
      fontFamily: {
        sans: ["var(--font-vazir)", "system-ui", "sans-serif"],
        display: ["var(--font-cormorant)", "var(--font-vazir)", "serif"],
      },
      maxWidth: {
        content: "1180px",
      },
      letterSpacing: {
        label: "0.18em",
      },
      boxShadow: {
        luxe: "0 18px 50px -20px rgba(0,0,0,0.45)",
        card: "0 10px 30px -18px rgba(0,0,0,0.35)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scan: {
          "0%": { top: "0%" },
          "100%": { top: "100%" },
        },
        "color-pop": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "70%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(201,169,110,0.4)" },
          "50%": { boxShadow: "0 0 0 12px rgba(201,169,110,0)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "swatch-in": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s ease-out both",
        scan: "scan 2.4s ease-in-out infinite",
        "color-pop": "color-pop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        "swatch-in": "swatch-in 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
