/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0f172a',      // slate-900
          surface: '#1e293b', // slate-800
          card: '#334155',    // slate-700
          border: '#475569',  // slate-600
          primary: '#10b981', // emerald-500
          primaryHover: '#059669', // emerald-600
          input: '#020617',   // slate-955
          danger: '#ef4444',
          warning: '#f59e0b',
        }
      },
    },
  },
  plugins: [],
}
