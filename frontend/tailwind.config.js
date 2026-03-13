// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: [
        "./src/**/*.{js,jsx,ts,tsx}", // Adjust this to match your project structure
    ],
    theme: {
        extend: {
            fontFamily: {
                "instrument-sans": ["Instrument Sans", "sans-serif"],
                inter: ["Inter", "sans-serif"],
            },
            colors: {
                brand: {
                    light: "#3AB0FF",
                    DEFAULT: "#0081CF",
                    dark: "#005F99",
                },
                // Or just a flat custom color
                darkGray: "#282A2C",
            },
        },
    },
};


theme: {
  extend: {
    colors: {
      primary: {
        50: '#f0fdf4',
        500: '#10b981',
        600: '#059669',
        700: '#047857'
      },
      accent: { 500: '#f59e0b' },
      neutral: {
        900: '#0f172a',
        50: '#f1f5f9'
      }
    },
    borderRadius: {
      '2xl': '16px'
    }
  }
}
