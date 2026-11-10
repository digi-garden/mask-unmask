/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Official digi-garden identity colors. Do not reassign these to UI states.
        identity: {
          primary: '#216B73',
          accent: '#F29A65',
          background: '#FAFAF8',
          inverse: '#153F44',
        },
        // Legacy brand-* classes are functional product UI semantics, not a
        // substitute for the immutable identity palette or formal logo artwork.
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
