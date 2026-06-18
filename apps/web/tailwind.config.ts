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
          // Trust-blue CUSTOM (đậm & bão hoà hơn Tailwind default) — brand personality, khí chất fintech đáng tin.
          50: "#eef3ff",
          100: "#d8e4ff",
          200: "#b6ccff",
          300: "#8aaaff",
          400: "#5680fb",
          500: "#2f63f5",
          600: "#1b4ddb",
          700: "#1740b4",
          800: "#163592",
          900: "#182d6e",
          950: "#101b44"
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
        info: { DEFAULT: "#1b4ddb", soft: "#d8e4ff", ink: "#163592" },

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
          accent: "#1b4ddb",
          "accent-hover": "#1740b4",
          "accent-soft": "#d8e4ff",
          "accent-ink": "#182d6e",
          success: "#16a34a",
          "success-soft": "#dcfce7",
          warning: "#d97706",
          "warning-soft": "#fef3c7",
          danger: "#dc2626",
          "danger-soft": "#fee2e2",
          info: "#1b4ddb",
          "info-soft": "#d8e4ff"
        }
      },
      fontSize: {
        // ── Typographic scale TÊN RIÊNG (không đụng base/sm Tailwind → prose blog an toàn).
        micro: ["0.6875rem", { lineHeight: "1rem" }], // 11/16 — label uppercase, micro-meta
        caption: ["0.75rem", { lineHeight: "1rem" }], // 12/16 — meta, caption
        "body-sm": ["0.8125rem", { lineHeight: "1.125rem" }], // 13/18 — body phụ, card meta
        body: ["0.9375rem", { lineHeight: "1.375rem" }], // 15/22 — body chính
        "body-lg": ["1rem", { lineHeight: "1.5rem" }], // 16/24 — lead, label form
        "title-sm": ["1.125rem", { lineHeight: "1.625rem" }], // 18/26 — sub-heading
        title: ["1.25rem", { lineHeight: "1.75rem" }], // 20/28 — heading card/section
        "title-lg": ["1.5rem", { lineHeight: "2rem" }], // 24/32 — heading trang
        "display-sm": ["1.875rem", { lineHeight: "2.375rem" }], // 30/38 — hero phụ
        display: ["2.5rem", { lineHeight: "2.875rem" }] // 40/46 — hero chính
      },
      boxShadow: {
        // Bóng trung tính, sâu hơn — card "floating" (bỏ phẳng lỳ).
        card: "0 1px 2px rgba(15, 23, 42, 0.06), 0 2px 6px rgba(15, 23, 42, 0.08)",
        "card-md": "0 6px 18px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.06)",
        "card-lg": "0 18px 44px rgba(15, 23, 42, 0.14), 0 6px 14px rgba(15, 23, 42, 0.06)",
        // AI signature glow — CHỈ dùng ở khối AI (ai-hero, ai-assistant, badge AI).
        "ai-glow": "0 8px 30px rgba(99, 102, 241, 0.18), 0 2px 10px rgba(34, 211, 238, 0.12)",
        "ai-glow-sm": "0 4px 16px rgba(99, 102, 241, 0.14)",
        // Legacy aliases → trỏ về bóng trung tính (admin dùng, giữ tương thích).
        google: "0 1px 2px 0 rgba(15, 23, 42, 0.08), 0 1px 3px 1px rgba(15, 23, 42, 0.06)",
        "google-md": "0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 4px 8px 3px rgba(15, 23, 42, 0.06)",
        glow: "0 8px 28px rgba(27, 77, 219, 0.18)",
        "glow-sm": "0 4px 14px rgba(27, 77, 219, 0.12)",
        pop: "0 18px 38px -16px rgba(15, 23, 42, 0.18), 0 6px 14px -6px rgba(15, 23, 42, 0.08)"
      },
      backgroundImage: {
        // Gradient brand → trust-blue custom. CTA gradient → amber (giữ).
        "brand-gradient": "linear-gradient(135deg, #2f63f5 0%, #1b4ddb 60%, #1740b4 100%)",
        "cta-gradient": "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
        // AI gradient signature → indigo → violet → cyan (RIÊNG khối AI).
        "ai-gradient": "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #22d3ee 100%)",
        "ai-mesh":
          "radial-gradient(55% 55% at 12% 10%, rgba(99, 102, 241, 0.14) 0%, rgba(99, 102, 241, 0) 60%), radial-gradient(45% 45% at 92% 8%, rgba(34, 211, 238, 0.10) 0%, rgba(34, 211, 238, 0) 60%)",
        // accent-gradient (legacy, savings) → green.
        "accent-gradient": "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)",
        // Mesh nền: nhẹ, đơn sắc trust-blue.
        "hero-mesh":
          "radial-gradient(60% 60% at 15% 15%, rgba(27, 77, 219, 0.10) 0%, rgba(27, 77, 219, 0) 60%), radial-gradient(45% 45% at 90% 10%, rgba(27, 77, 219, 0.06) 0%, rgba(27, 77, 219, 0) 60%)",
        "admin-mesh":
          "radial-gradient(60% 50% at 0% 0%, rgba(27, 77, 219, 0.06) 0%, rgba(27, 77, 219, 0) 60%)",
        "admin-accent-gradient": "linear-gradient(135deg, #2f63f5 0%, #1b4ddb 60%, #1740b4 100%)"
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
