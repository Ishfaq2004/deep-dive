/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Same tokens already established in the Figma prototype, so the
      // built screens and the mockups stay one visual language instead
      // of drifting into two different "designs" again.
      colors: {
        abyss: "#0A1628",
        mid: "#123150",
        midLight: "#1B456D",
        cyan: "#39E6C9",
        gold: "#F2B84B",
        coral: "#FF6B5B",
        sidebar: "#07101C",
        textDim: "#9FB9CE",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
