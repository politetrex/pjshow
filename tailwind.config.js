/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.{html,js}",
    "!./node_modules/**",
    "!./.git/**",
    "!./dist/**",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
      },
    },
  },
  plugins: [],
};