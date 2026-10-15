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
          50: '#FFF3F0',
          100: '#FDE4DF',
          200: '#FAC8BE',
          300: '#F4A08F',
          500: '#E8452C',
          600: '#CF3A22',
          700: '#B02F1B',
          800: '#8C2616',
        },
        maroon: { 50: '#FFF1F2', 100: '#FFE4E6', 600: '#8E2938', 700: '#7A1F2B', 800: '#651B25' },
        warm: {
          50: '#F4F5F7',
          100: '#ECEEF2',
          200: '#DFE2E8',
          300: '#C6CBD4',
          400: '#9AA1AD',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        templeGreen: {
          50: '#EFF7F1',
          100: '#DDEEE1',
          200: '#BFDDC6',
          500: '#4A7C59',
          700: '#35543F',
          800: '#26402F',
        },
        danger: { 50: '#FDF2F0', 100: '#FBE3DF', 500: '#C0392B', 700: '#89291F' },
        bell: { 50: '#FFFAEB', 100: '#FFF0C2', 200: '#FFE08A', 500: '#C98B17', 700: '#884E13' },
      },
      borderRadius: { xl: '12px', '2xl': '16px', '3xl': '20px' },
      fontFamily: {
        body: ['Inter', 'NotoSansDevanagari'],
        heading: ['Poppins', 'NotoSansDevanagari'],
      },
    },
  },
  plugins: [],
};
