// Tailwind theme for Coast Turtle's IT Land (black & green).
// After changing classes in any .html or js/*.js file, rebuild the stylesheet with:
//   npm run build:css
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./*.html', './partials/*.html', './js/**/*.js'],
    theme: {
        extend: {
            colors: {
                page: '#080b09',      // page background
                night: '#050705',     // darkest bands: top bar, page headers, footer
                forest: '#0d1a10',    // middle of the hero gradient
                surface: '#101612',   // cards and header
                sunken: '#0d120f',    // alternate section / inset card background
                raised: '#101b13',    // highlighted panels
                field: '#0b100d',     // form inputs
                line: {
                    DEFAULT: '#26382b', // borders and dividers
                    strong: '#315439'   // form input borders
                },
                ink: '#effff2',       // headings and body text
                muted: '#b7cdbb',     // secondary text
                accent: {
                    DEFAULT: '#159447',     // buttons and green panels
                    bright: '#22c55e',      // hover state
                    light: '#63e68a',       // green text and icons on dark backgrounds
                    deep: '#0d6b32',        // gradient start
                    border: '#2fbd65',
                    soft: '#122b1a',        // tinted icon tiles
                    'soft-hover': '#194426',
                    'soft-border': '#285b37'
                },
                'on-accent': '#031108'      // text on green backgrounds
            },
            borderColor: {
                DEFAULT: '#26382b'
            },
            borderRadius: {
                '2xl': '1rem',
                '3xl': '1rem'
            },
            boxShadow: {
                xl: '0 20px 50px rgba(0, 0, 0, 0.28)',
                '2xl': '0 24px 60px rgba(0, 0, 0, 0.35)'
            },
            fontFamily: {
                sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
                readable: ['"Atkinson Hyperlegible"', '"Trebuchet MS"', 'sans-serif']
            }
        }
    },
    plugins: []
};
