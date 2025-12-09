/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],    // or your brand font
        mono: ["JetBrains Mono", "monospace"], // if used in SPA
      },
      colors: {
        brand: {
          primary: "#5ccfa2",
          dark: "#010112",
          card: "#10101d",
        }
      }
    },
  },
  plugins: [],
};

export default config;
