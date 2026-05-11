/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './screens/**/*.html',
    './screens/**/*.js'
  ],
  theme: {
    extend: {
      fontFamily: {
        cairo: ['Cairo', 'sans-serif']
      },
      colors: {
        teal: {
          400: '#00c9c8',
          500: '#00b4b3',
          600: '#0099a0'
        },
        navy: {
          900: '#0d1b2a',
          800: '#112236',
          700: '#1a3a5c'
        }
      }
    }
  },
  plugins: []
};
