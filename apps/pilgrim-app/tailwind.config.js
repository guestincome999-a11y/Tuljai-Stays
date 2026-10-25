/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        saffron: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          500: '#E67E22',
          600: '#C96818',
          700: '#A64F12',
          800: '#853F16',
        },
        maroon: { 50: '#FFF1F2', 100: '#FFE4E6', 600: '#8E2938', 700: '#7A1F2B', 800: '#651B25' },
        warm: {
          50: '#FAF7F2',
          100: '#F4EEE6',
          200: '#E8DED2',
          300: '#D7C8B8',
          500: '#817267',
          600: '#62554E',
          700: '#493D38',
          900: '#2B2320',
        },
        templeGreen: { 50: '#EFF7F1', 100: '#DDEEE1', 500: '#4A7C59', 700: '#35543F' },
        danger: { 50: '#FDF2F0', 100: '#FBE3DF', 500: '#C0392B', 700: '#89291F' },
        bell: { 50: '#FFFAEB', 100: '#FFF0C2', 500: '#C98B17', 700: '#884E13' },
      },
      borderRadius: { xl: '16px', '2xl': '24px', '3xl': '30px' },
      fontFamily: {
        body: ['Inter', 'NotoSansDevanagari'],
        heading: ['Poppins', 'NotoSansDevanagari'],
      },
    },
  },
  plugins: [],
};
