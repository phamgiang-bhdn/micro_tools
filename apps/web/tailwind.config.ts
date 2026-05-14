import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        google: {
          blue: "#1a73e8",
          "blue-hover": "#1557b0",
          surface: "#ffffff",
          "surface-tint": "#f8f9fa",
          outline: "#dadce0",
          ink: "#202124",
          "ink-secondary": "#5f6368",
          error: "#d93025",
          success: "#1e8e3e",
          warning: "#f9ab00"
        },
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
        canvas: "#fbf8f5",
        card: "#ffffff"
      },
      boxShadow: {
        google: "0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)",
        "google-md": "0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15)",
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        "card-md": "0 4px 14px rgba(16, 24, 40, 0.08), 0 2px 4px rgba(16, 24, 40, 0.04)",
        "card-lg": "0 12px 32px rgba(16, 24, 40, 0.12), 0 4px 8px rgba(16, 24, 40, 0.04)",
        glow: "0 8px 28px rgba(255, 59, 47, 0.28)"
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #ff6a5b 0%, #ee1f12 60%, #871a13 100%)",
        "accent-gradient": "linear-gradient(135deg, #46bb8c 0%, #13845a 100%)",
        "hero-mesh":
          "radial-gradient(60% 60% at 15% 20%, rgba(255, 106, 91, 0.25) 0%, rgba(255, 106, 91, 0) 60%), radial-gradient(50% 50% at 90% 10%, rgba(70, 187, 140, 0.22) 0%, rgba(70, 187, 140, 0) 60%), radial-gradient(45% 45% at 80% 90%, rgba(238, 31, 18, 0.18) 0%, rgba(238, 31, 18, 0) 60%)"
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
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        shimmer: "shimmer 1.4s linear infinite"
      }
    }
  },
  plugins: []
};

export default config;
