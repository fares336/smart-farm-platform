/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'Cairo', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16' },
        soil: { 50: '#fdf8f3', 100: '#f6ebdd', 500: '#a16207', 700: '#713f12' },
      },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.08)' },
    },
  },
  plugins: [],
};
