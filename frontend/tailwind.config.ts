import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        vera: "8px",
      },
      colors: {
        amber: "var(--color-amber)",
        "amber-soft": "var(--color-amber-soft)",
        danger: "var(--color-danger)",
        "danger-line": "var(--color-danger-line)",
        "danger-soft": "var(--color-danger-soft)",
        ink: "var(--color-ink)",
        line: "var(--color-line)",
        muted: "var(--color-muted)",
        paper: "var(--color-paper)",
        success: "var(--color-success)",
        "success-line": "var(--color-success-line)",
        "success-soft": "var(--color-success-soft)",
        surface: "var(--color-surface)",
        teal: "var(--color-teal)",
        "teal-soft": "var(--color-teal-soft)",
        "teal-strong": "var(--color-teal-strong)",
      },
    },
  },
  plugins: [],
};

export default config;
