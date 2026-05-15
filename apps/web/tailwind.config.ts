import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";
import animate from "tailwindcss-animate";

/**
 * Design tokens hợp nhất cho cả public storefront và admin shell.
 * - `canvas` (cream) làm nền cho user-facing UI; `surface` (white) cho card.
 * - `slate-*` tones là backbone cho admin (đậm, info-dense) — tránh dùng google-* deprecated.
 * - Brand red giữ riêng cho conversion CTA; accent green cho tín hiệu success/savings.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff1f0",
          100: "#ffe1de",
          200: "#ffc7c1",
          300: "#ff9d92",
          400: "#ff6a5b",
          500: "#ff3b2f",
          600: "#ee1f12",
          700: "#c5160c",
          800: "#a3160e",
          900: "#871a13",
          950: "#4a0805"
        },
        accent: {
          50: "#effbf6",
          100: "#d8f4e6",
          200: "#b3e8cf",
          300: "#7fd5b1",
          400: "#46bb8c",
          500: "#1fa471",
          600: "#13845a",
          700: "#106a4a",
          800: "#0f543c",
          900: "#0d4532"
        },
        ink: {
          DEFAULT: "#0e1116",
          soft: "#3a3f47",
          mute: "#6b7280"
        },
        line: "#e5e7eb",
        "line-strong": "#d1d5db",
        canvas: "#fbf8f5",
        card: "#ffffff",
        admin: {
          bg: "#f6f7f9",
          surface: "#ffffff",
          ink: "#0f172a",
          mute: "#475569",
          line: "#d8dee7",
          subtle: "#eef2f7",
          accent: "#1d4ed8",
          "accent-soft": "#dbeafe"
        },
        // Tokens cũ (google-*) giữ alias để file legacy không vỡ — sẽ phai dần.
        google: {
          blue: "#2563eb",
          "blue-hover": "#1d4ed8",
          surface: "#ffffff",
          "surface-tint": "#f1f5f9",
          outline: "#e2e8f0",
          ink: "#0f172a",
          "ink-secondary": "#64748b",
          error: "#dc2626",
          success: "#16a34a",
          warning: "#d97706"
        }
      },
      boxShadow: {
        google: "0 1px 2px 0 rgba(15, 23, 42, 0.08), 0 1px 3px 1px rgba(15, 23, 42, 0.06)",
        "google-md": "0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 4px 8px 3px rgba(15, 23, 42, 0.06)",
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        "card-md": "0 4px 14px rgba(16, 24, 40, 0.08), 0 2px 4px rgba(16, 24, 40, 0.04)",
        "card-lg": "0 12px 32px rgba(16, 24, 40, 0.12), 0 4px 8px rgba(16, 24, 40, 0.04)",
        glow: "0 8px 28px rgba(255, 59, 47, 0.28)",
        "glow-sm": "0 4px 14px rgba(255, 59, 47, 0.18)",
        pop: "0 18px 38px -16px rgba(238, 31, 18, 0.32), 0 6px 14px -6px rgba(15, 23, 42, 0.08)"
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #ff6a5b 0%, #ee1f12 60%, #871a13 100%)",
        "accent-gradient": "linear-gradient(135deg, #46bb8c 0%, #13845a 100%)",
        "hero-mesh":
          "radial-gradient(60% 60% at 15% 20%, rgba(255, 106, 91, 0.25) 0%, rgba(255, 106, 91, 0) 60%), radial-gradient(50% 50% at 90% 10%, rgba(70, 187, 140, 0.22) 0%, rgba(70, 187, 140, 0) 60%), radial-gradient(45% 45% at 80% 90%, rgba(238, 31, 18, 0.18) 0%, rgba(238, 31, 18, 0) 60%)",
        "admin-mesh":
          "radial-gradient(60% 50% at 0% 0%, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0) 60%), radial-gradient(40% 40% at 100% 0%, rgba(20, 184, 166, 0.06) 0%, rgba(20, 184, 166, 0) 60%)"
      },
      borderRadius: {
        "2.5xl": "1.25rem",
        "4xl": "2rem"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" }
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(238, 31, 18, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(238, 31, 18, 0)" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        "fade-in": "fade-in 0.3s ease-out both",
        "slide-in-right": "slide-in-right 0.35s ease-out both",
        shimmer: "shimmer 1.4s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite"
      }
    }
  },
  plugins: [typography, animate]
};

export default config;
