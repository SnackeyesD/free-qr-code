/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scan: {
          // le beam fait h-1/3 : -110% = juste au-dessus, 340% = juste en dessous
          from: { transform: 'translateY(-110%)' },
          to: { transform: 'translateY(340%)' },
        },
        // Scène SVG : les keyframes qr-pop/qr-scan/qr-settle vivent dans
        // index.css en CSS pur (pas de classes animate-* associées).
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        scan: 'scan 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
