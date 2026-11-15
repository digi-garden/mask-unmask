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
        // Legacy brand-* UI aliases retain existing classes while using CircleNote tones.
        // Identity colors are unchanged but must not be used as dark-background text.
        brand: {
          bg: '#071318',
          surface: '#0F2329',
          card: '#1A343A',
          border: '#45656A',
          primary: '#79D6CA',
          primaryHover: '#9CE5DC',
          input: '#071318',
          danger: '#FFB4AB',
          warning: '#F5C477',
        },
        slate: {
          50: '#E5EEF0',
          100: '#E5EEF0',
          200: '#E5EEF0',
          300: '#B8C8CC',
          400: '#B8C8CC',
          500: '#8FA5AA',
          600: '#45656A',
          700: '#45656A',
        },
        cn: {
          bg: '#071318',
          'bg-glow': '#123039',
          surface: '#0F2329',
          border: '#29464D',
          'border-strong': '#45656A',
          text: '#E5EEF0',
          'text-muted': '#B8C8CC',
          'text-subtle': '#8FA5AA',
          accent: '#79D6CA',
          'accent-hover': '#9CE5DC',
          'accent-border': '#34786E',
          'on-accent': '#071318',
          link: '#B2EEE6',
          focus: '#E5EEF0',
          apricot: '#F29A65',
          warning: '#F5C477',
          error: '#FFB4AB',
          success: '#79D6CA',
        },
      },
    },
  },
  plugins: [],
}
