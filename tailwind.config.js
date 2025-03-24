const tokens = require('@contentful/f36-tokens');
const { fontFamily } = require('tailwindcss/defaultTheme');

// 使用 Contentful 的顏色令牌作為基礎
const contentfulColors = Object.entries(tokens).reduce((acc, [key, value]) => {
  // Filter Hex colors from the f36-tokens
  if (/^#[0-9A-F]{6}$/i.test(value)) {
    acc[key] = value;
  }

  return acc;
}, {});

// 專業主題色系
const professionalColors = {
  // 深藍色系列
  'blue-dark': '#0A2342',
  'blue-medium': '#1D4D7A',
  'blue-light': '#337AB7',
  'blue-accent': '#5CA9D6',

  // 灰色系列
  'gray-darkest': '#1A1A1A',
  'gray-dark': '#2D2D2D',
  'gray-medium': '#555555',
  'gray-light': '#8C8C8C',
  'gray-lightest': '#E0E0E0',

  // 輔助色系
  'accent-teal': '#2D7D8A',
  'accent-slate': '#3F5E6C',
  'accent-warm': '#A67F59',

  // 反饋色系
  'success': '#2E7D32',
  'warning': '#EF6C00',
  'error': '#C62828',
  'info': '#1565C0',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/**/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    colors: {
      ...contentfulColors,
      ...professionalColors,
      // 保留基本色彩
      white: '#FFFFFF',
      black: '#000000',
      transparent: 'transparent',
    },
    extend: {
      maxWidth: {
        '8xl': '90rem',
      },
      letterSpacing: {
        snug: '-0.011em',
      },
      fontSize: {
        '2xs': '0.625rem',
        '3xl': '1.75rem',
        '4xl': '2.5rem',
      },
      lineHeight: {
        tighter: 1.1,
      },
      fontFamily: {
        sans: ['var(--font-urbanist)', ...fontFamily.sans],
      },
      boxShadow: {
        'subtle': '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)',
        'medium': '0 4px 6px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.1)',
        'elevated': '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
