const frappeUIPreset = require("frappe-ui/tailwind");

module.exports = {
	presets: [frappeUIPreset],
	content: [
		"./src/**/*.{vue,js,ts,jsx,tsx}",
		"./node_modules/frappe-ui/src/components/{Button,Badge,TextInput,Input,Dropdown}/**/*.{vue,js,ts,jsx,tsx}",
	],
	darkMode: "class",
};
