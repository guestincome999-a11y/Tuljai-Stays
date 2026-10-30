/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ...require('./src/pilgrim-ui/design-tokens.json').colors,
        // Compatibility alias for existing controls; all primary actions now use maroon.
        saffron: {
          50: '#FAEEF2',
          100: '#F3DAE3',
          200: '#E7BDCD',
          300: '#D58BA6',
          500: '#800D32',
          600: '#590923',
          700: '#590923',
          800: '#45071B',
        },
      },
      borderRadius: { xl: '12px', '2xl': '18px', '3xl': '24px' },
      fontFamily: {
        body: ['Inter', 'NotoSansDevanagari'],
        heading: ['Fraunces_600SemiBold'],
      },
    },
  },
  plugins: [],
};
