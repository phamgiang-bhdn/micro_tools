import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";
import animate from "tailwindcss-animate";

/**
 * Design system V3 — MỘT hệ token trust-blue duy nhất, dùng chung storefront + admin.
 *
 * Canonical (code mới chỉ dùng các tên này):
 *  - `primary`  : blue, màu thương hiệu / tin cậy / link / focus.
 *  - `cta`      : amber ấm — CHỈ cho conversion ("Xem deal") + badge 🤖 AI. Đừng dùng tràn lan.
 *  - `ink/-soft/-mute` : text 3 cấp (slate-900/700/500).
 *  - `canvas`   : nền trang (slate-50). `surface`/`surface-2` : card / panel phụ.
 *  - `border`/`border-strong` : viền.
 *  - `success/warning/danger/info` : semantic, mỗi cái có `.soft` (nền nhạt) + `.ink` (chữ đậm).
 *
 * Legacy aliases (brand/google/admin/accent/line/card): TẠM remap về hệ mới để file cũ
 *   vẫn compile và tự đổi màu (đỏ/tím → xanh). Sẽ XOÁ ở Phase 6 sau khi migrate hết.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ─── Canonical ────────────────────────────────────────────────
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554"
        },
        cta: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309"
        },
        ink: {
          DEFAULT: "#0f172a", // slate-900
          soft: "#334155", // slate-700
          mute: "#64748b" // slate-500
        },
        canvas: "#f8fafc", // slate-50 — nền trang (cả storefront lẫn admin)
        surface: "#ffffff",
        "surface-2": "#f1f5f9", // slate-100 — panel/well phụ
        border: "#e2e8f0", // slate-200
        "border-strong": "#cbd5e1", // slate-300
        success: { DEFAULT: "#16a34a", soft: "#dcfce7", ink: "#166534" },
        warning: { DEFAULT: "#d97706", soft: "#fef3c7", ink: "#92400e" },
        danger: { DEFAULT: "#dc2626", soft: "#fee2e2", ink: "#991b1b" },
        info: { DEFAULT: "#2563eb", soft: "#dbeafe", ink: "#1e40af" },

        // ─── Legacy aliases còn lại (map → hệ mới; tên không gây hiểu lầm) ──
        // accent (xanh-lá cũ, dùng cho savings) → success green giữ ngữ nghĩa.
        accent: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d"
        },
        line: "#e2e8f0",
        "line-strong": "#cbd5e1",
        card: "#ffffff",
        // admin (indigo/tím cũ) → neutral slate + primary blue accent.
        admin: {
          bg: "#f8fafc",
          surface: "#ffffff",
          "surface-2": "#f1f5f9",
          ink: "#0f172a",
          "ink-soft": "#334155",
          mute: "#475569",
          "mute-soft": "#64748b",
          line: "#e2e8f0",
          "line-strong": "#cbd5e1",
          subtle: "#f1f5f9",
          "subtle-hover": "#e2e8f0",
          accent: "#2563eb",
          "accent-hover": "#1d4ed8",
          "accent-soft": "#dbeafe",
          "accent-ink": "#1e3a8a",
          success: "#16a34a",
          "success-soft": "#dcfce7",
          warning: "#d97706",
          "warning-soft": "#fef3c7",
          danger: "#dc2626",
          "danger-soft": "#fee2e2",
          info: "#2563eb",
          "info-soft": "#dbeafe"
        }
      },
      boxShadow: {
        // Bóng trung tính, mềm — bỏ glow đỏ.
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
        "card-md": "0 4px 14px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04)",
        "card-lg": "0 12px 32px rgba(15, 23, 42, 0.12), 0 4px 8px rgba(15, 23, 42, 0.04)",
        // Legacy aliases → trỏ về bóng trung tính.
        google: "0 1px 2px 0 rgba(15, 23, 42, 0.08), 0 1px 3px 1px rgba(15, 23, 42, 0.06)",
        "google-md": "0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 4px 8px 3px rgba(15, 23, 42, 0.06)",
        glow: "0 8px 28px rgba(37, 99, 235, 0.18)",
        "glow-sm": "0 4px 14px rgba(37, 99, 235, 0.12)",
        pop: "0 18px 38px -16px rgba(15, 23, 42, 0.18), 0 6px 14px -6px rgba(15, 23, 42, 0.08)"
      },
      backgroundImage: {
        // Gradient brand → xanh dương (bỏ đỏ). CTA gradient → amber.
        "brand-gradient": "linear-gradient(135deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%)",
        "cta-gradient": "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
        // accent-gradient (legacy, savings) → green.
        "accent-gradient": "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)",
        // Mesh nền: nhẹ, đơn sắc xanh (bỏ mesh đỏ-xanh-lá hỗn loạn).
        "hero-mesh":
          "radial-gradient(60% 60% at 15% 15%, rgba(37, 99, 235, 0.10) 0%, rgba(37, 99, 235, 0) 60%), radial-gradient(45% 45% at 90% 10%, rgba(37, 99, 235, 0.06) 0%, rgba(37, 99, 235, 0) 60%)",
        "admin-mesh":
          "radial-gradient(60% 50% at 0% 0%, rgba(37, 99, 235, 0.06) 0%, rgba(37, 99, 235, 0) 60%)",
        "admin-accent-gradient": "linear-gradient(135deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%)"
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
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" }
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        "fade-in": "fade-in 0.3s ease-out both",
        "slide-in-right": "slide-in-right 0.35s ease-out both",
        "slide-in-left": "slide-in-left 0.25s ease-out both",
        "slide-up": "slide-up 0.3s ease-out both",
        shimmer: "shimmer 1.4s linear infinite"
      }
    }
  },
  plugins: [typography, animate]
};

export default config;
