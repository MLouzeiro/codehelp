/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E6F6F6',
          100: '#B3E4E6',
          200: '#80D2D6',
          300: '#4DC0C6',
          400: '#26B0B6',
          500: '#0D7377',
          600: '#095255',
          700: '#063134',
          800: '#031012',
        },
      },
    },
  },
  plugins: [],
}
