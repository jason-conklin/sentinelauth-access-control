module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#FACC15',
        'brand-200': '#FDE68A',
        'brand-300': '#FBBF24',
        'brand-400': '#F1C40F',
        'border-gold': '#E0C95C',
        'bg-base': '#FFFDF7',
        'text-ink': '#1A1A1A',
        'grad-left': '#FFF3B0',
        'grad-right': '#FDE68A',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.03)',
      },
    },
  },
  plugins: [],
};
