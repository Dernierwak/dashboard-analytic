import type { Config } from "tailwindcss";

// Design system porté depuis le Streamlit (mêmes tokens → identité conservée)
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#1a56ff",
        ink: "#0e0f12",
        muted: "#5a5d66",
        faint: "#8b8e98",
        line: "rgba(14,15,18,0.08)",
        canvas: "#faf9f6",
        pos: "#1a7a4a",
        neg: "#c0392b",
        warn: "#b86b00",
        ig: "#7b4fff", // Instagram
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "ui-monospace", "monospace"],
        serif: ["Georgia", "serif"],
      },
      borderRadius: { xl: "14px", "2xl": "16px" },
      boxShadow: { card: "0 1px 3px rgba(14,15,18,0.04)" },
    },
  },
  plugins: [],
};
export default config;
