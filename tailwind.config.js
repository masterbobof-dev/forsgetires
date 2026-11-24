/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
  // on phones a finger scrolling over a tile must not leave it highlighted
  future: { hoverOnlyWhenSupported: true },
};
