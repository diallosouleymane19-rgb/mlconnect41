import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          700: '#0369a1',
          800: '#075985',
          900: '#0c2d48',
        },
      },
    },
  },
  plugins: [],
}
export default config
