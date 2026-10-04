const frappeUIPreset = require("frappe-ui/tailwind");

module.exports = {
	presets: [frappeUIPreset],
	content: [
		"./src/**/*.{vue,js,ts,jsx,tsx}",
		"./omnitrack/www/omnitrack.html",
		"./node_modules/frappe-ui/src/components/**/*.{vue,js,ts,jsx,tsx}",
	],
	safelist: [
		"bg-rose-50",
		"bg-rose-100",
		"bg-rose-500",
		"bg-rose-600",
		"bg-rose-700",
		"text-rose-600",
		"text-rose-700",
		"border-rose-200",
		"border-rose-300",
	],
	darkMode: "class",
	theme: {
		extend: {
			fontFamily: {
				sans: ['"Google Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
				mono: ['"JetBrains Mono"', 'monospace'],
			},
			gridTemplateColumns: {
				'24': 'repeat(24, minmax(0, 1fr))',
			},
			colors: {
				rose: require("tailwindcss/colors").rose,
				emerald: require("tailwindcss/colors").emerald,
				slate: require("tailwindcss/colors").slate,
				brand: {
					blue: '#4285F4',
					green: '#34A853',
					red: '#EA4335',
					yellow: '#FBBC05',
					purple: '#673AB7',
				}
			}
		}
	}
};
