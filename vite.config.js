import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import frappeui from "frappe-ui/vite";
import { resolve } from "node:path";

export default defineConfig({
	plugins: [
		frappeui(),
		vue(),
	],
	css: {
		postcss: resolve(__dirname, "postcss.config.cjs"),
	},
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
	},
	build: {
		outDir: "omnitrack/public/dist",
		emptyOutDir: false,
		assetsDir: ".",
		cssCodeSplit: false,
		assetsInlineLimit: 0,
		lib: {
			entry: resolve(__dirname, "src/timesheet_session/main.js"),
			name: "OmniTrackSessionBox",
			formats: ["iife"],
			fileName: () => "timesheet_session_box.bundle.js",
		},
		rollupOptions: {
			output: {
				assetFileNames: (info) => {
					if ((info.name || "").endsWith(".css")) return "timesheet_session_box.bundle.css";
					return "[name][extname]";
				},
				inlineDynamicImports: true,
			},
		},
	},
});
