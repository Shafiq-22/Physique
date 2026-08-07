/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0b0f14',
          800: '#111823',
          700: '#1a2430',
          600: '#26323f',
        },
        accent: '#4ade80',
        warn: '#fbbf24',
        danger: '#f87171',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
