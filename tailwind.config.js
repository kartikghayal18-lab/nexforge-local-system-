/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0a0e17',
          50: '#f5f6f8',
          100: '#11151f',
          200: '#161b26',
          300: '#1c212e',
          400: '#242a38',
          500: '#2b3242',
        },
        accent: {
          DEFAULT: '#5b6bf5',
          50: '#eef0fe',
          100: '#dde1fd',
          400: '#7c8af7',
          500: '#5b6bf5',
          600: '#4753d6',
          700: '#3a44ad',
        },
        ink: {
          100: '#f4f5f7',
          300: '#c4c9d4',
          400: '#8b93a7',
          500: '#6b7385',
          600: '#4d5566',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(0,0,0,0.3), 0 1px 3px 0 rgba(0,0,0,0.2)',
        panel: '0 4px 24px -4px rgba(0,0,0,0.4)',
      },
      borderRadius: {
        xl: '10px',
      },
    },
  },
  plugins: [],
}
