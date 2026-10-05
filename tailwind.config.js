/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Official RCCG palette: blue #180C62, green #028A2C, red #D61812.
        // The "500/600/700" steps are the brand value and slightly deeper
        // shades of it (used for hover states and text contrast).
        rccg: {
          purple: {
            50: "#F4F2FB",
            100: "#E5E1F4",
            200: "#CBC4E7",
            300: "#A99DD3",
            400: "#7E6EB8",
            500: "#52409E",
            600: "#2F1C86",
            700: "#180C62",
            800: "#110949",
            900: "#0B0535",
          },
          green: {
            50: "#E6F4EA",
            100: "#C7E6D0",
            200: "#92CDA4",
            500: "#028A2C",
            600: "#027A27",
            700: "#046A23",
          },
          red: {
            50: "#FDEDEC",
            100: "#FAD4D1",
            500: "#E5463F",
            600: "#D61812",
            700: "#B5130E",
          },
        },
        ink: "#1B1440",
        muted: "#6B6688",
        line: "#E6E3F0",
        mist: "#F6F5FA",
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
