/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identidade 5G — laranja como CTA principal
        laranja: {
          DEFAULT: '#ff6a00',
          hover: '#ff7e1f',
          dark: '#cc5500',
          soft: '#fff1e6',
          border: '#ffd5b3',
        },
        // Cards de peca (azul-ciano)
        peca: {
          DEFAULT: '#0891b2',
          soft: '#e0f7fb',
          border: '#a8e2ed',
          dark: '#0e6f88',
        },
        // Cards de acordo/reclamacao (ambar)
        acordo: {
          DEFAULT: '#b8851a',
          soft: '#fff4d9',
          border: '#f0d68a',
          dark: '#8a630e',
        },
        // Cores semanticas de status
        status: {
          aguarda: '#eab308',
          andamento: '#16a34a',
          instalado: '#2563eb',
          erro: '#dc2626',
          concluido: '#10b981',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
