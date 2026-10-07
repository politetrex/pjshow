/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*/index.html",
    "./src/**/*.js",
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