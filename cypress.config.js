// Run with: bench --site <site> run-ui-tests omnitrack --headless
// (Frappe's runner chdirs here and supplies baseUrl + adminPassword.)
// Plain object: omnitrack is "type": "module" and has no local cypress package to import.
export default {
	adminPassword: "admin",
	defaultCommandTimeout: 20000,
	pageLoadTimeout: 30000,
	video: false,
	viewportHeight: 960,
	viewportWidth: 1400,
	retries: { runMode: 1, openMode: 0 },
	e2e: {
		specPattern: "cypress/integration/**/*.js",
		supportFile: "cypress/support/e2e.js",
	},
};
