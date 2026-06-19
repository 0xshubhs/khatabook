import type { Config } from "tailwindcss";

// Khatabook color semantics (SPEC §3): red = they owe you / due, green = settled / advance.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        due: "#dc2626", // red — receivable / payment due
        settled: "#16a34a", // green — settled / advance
        accent: "#2563eb", // single accent color
      },
    },
  },
  plugins: [],
};

export default config;
