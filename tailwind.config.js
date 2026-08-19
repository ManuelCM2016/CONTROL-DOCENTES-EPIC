/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        maroon: {
          50:  '#fdf2f2',
          100: '#fce4e4',
          200: '#fbcdcd',
          300: '#f6a8a8',
          400: '#ee7676',
          500: '#e24848',
          600: '#c92a2a',
          700: '#a82222',
          800: '#7B2D2D',
          900: '#6B1D1D',
          950: '#3B0D0D',
        },
        institutional: {
          cream:  '#FFF8F0',
          warm:   '#FAF5F0',
          light:  '#F5EFEA',
          muted:  '#E8DDD4',
        }
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 4px 25px -5px rgba(123, 45, 45, 0.08), 0 10px 30px -5px rgba(0, 0, 0, 0.05)',
        'elevated': '0 10px 40px -10px rgba(123, 45, 45, 0.15), 0 4px 15px -3px rgba(0, 0, 0, 0.08)',
        'glow': '0 0 30px rgba(123, 45, 45, 0.15)',
        'input-focus': '0 0 0 4px rgba(123, 45, 45, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
