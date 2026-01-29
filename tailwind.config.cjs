/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/ui/index.html",
    "./src/ui/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 支援 Theming
  theme: {
    extend: {
      colors: {
        figma: {
          bg: 'var(--figma-color-bg)',
          text: 'var(--figma-color-text)',
          border: 'var(--figma-color-border)',
          accent: 'var(--figma-color-bg-brand)',
        }
      }
    },
  },
  plugins: [],
}
