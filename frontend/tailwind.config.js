/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Apple system font stack — falls back gracefully off macOS.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Inter"',
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        // Apple neutral palette
        ink: "#1d1d1f",
        subtle: "#6e6e73",
        hairline: "#d2d2d7",
        canvas: "#ffffff",
        mist: "#f5f5f7",
        // Brand + supply-chain accents
        timber: "#1a8f4c",
        timberLight: "#22c55e",
        ocean: "#0071e3", // Apple blue
        amber: "#b25e00",
        grape: "#6e56cf",
        danger: "#d70015",
      },
      borderRadius: {
        apple: "18px",
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.06)",
        cardHover: "0 8px 40px rgba(0,0,0,0.10)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};
