import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#bf5700",
          dark: "#8a3f00",
          light: "#fbe8d8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
