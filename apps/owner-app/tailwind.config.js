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
          50: '#FBF1F4',
          100: '#F8ECF0',
          200: '#EBCBD5',
          400: '#A32949',
          500: '#861632',
          600: '#70112A',
          700: '#5C1024',
          800: '#5C1024',
        },
        maroon: { 50: '#FFF1F2', 100: '#FFE4E6', 600: '#A32949', 700: '#861632', 800: '#5C1024' },
        warm: {
          50: '#FFF9F3',
          100: '#F5F0ED',
          200: '#EAE1DC',
          300: '#D8CDCA',
          500: '#666C78',
          600: '#666C78',
          700: '#464B56',
          900: '#20232B',
        },
        templeGreen: {
          50: '#EFF7F1',
          100: '#DDEEE1',
          500: '#4A7C59',
          700: '#35543F',
          800: '#2D4435',
        },
        danger: { 50: '#FDF2F0', 100: '#FBE3DF', 500: '#C0392B', 700: '#89291F' },
        bell: { 50: '#FFFAEB', 100: '#FFF0C2', 500: '#C98B17', 700: '#884E13', 800: '#713F17' },
      },
      borderRadius: { xl: '12px', '2xl': '18px' },
      fontFamily: { body: ['sans-serif'], heading: ['sans-serif'], devanagari: ['sans-serif'] },
    },
  },
  plugins: [],
};
