import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"]
      },
      colors: {
        background: "#010308",
        foreground: "#f8fafc",
        border: "rgba(255,255,255,0.06)",
        card: "rgba(3, 8, 14, 0.7)",
        primary: {
          DEFAULT: "#00f0ff",
          foreground: "#001a22"
        },
        success: {
          DEFAULT: "#00ff9d",
          foreground: "#002b1a"
        },
        danger: {
          DEFAULT: "#ff2a5f",
          foreground: "#3a000d"
        },
        warning: {
          DEFAULT: "#ffb300",
          foreground: "#332200"
        },
        muted: {
          DEFAULT: "rgba(227,239,247,0.08)",
          foreground: "rgba(227,239,247,0.5)"
        }
      },
      boxShadow: {
        glow: "0 0 60px rgba(0, 240, 255, 0.25)",
        danger: "0 0 60px rgba(255, 42, 95, 0.3)",
        glass: "inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 20px 40px -10px rgba(0, 0, 0, 0.8)"
      },
      backgroundImage: {
        grid:
          "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
