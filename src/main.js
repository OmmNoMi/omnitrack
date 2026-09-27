import * as Vue from "vue";
import { createApp, reactive, h } from "vue";
import { FrappeUI } from "frappe-ui";
import { io } from "socket.io-client";
import "frappe-ui/style.css";
import "./styles/main.css";
import SessionBox from "./timesheet_session/SessionBox.vue";

// Expose Vue, Frappe UI, and Socket.io globally for zero-CDN workstation operation
if (typeof window !== "undefined") {
	window.Vue = Vue;
	window.FrappeUI = FrappeUI;
	window.io = io;
}

let sessionBoxInstance = null;
let currentProps = null;

function mountSessionBox(target, props = {}) {
	const container = typeof target === "string" ? document.querySelector(target) : target;
	if (!container) {
		console.error("[OmniTrackSessionBox] Container not found:", target);
		return null;
	}

	if (sessionBoxInstance) {
		unmountSessionBox();
	}

	container.innerHTML = "";
	const root = document.createElement("div");
	root.id = "omnitrack-session-box-root";
	container.appendChild(root);

	currentProps = reactive({ ...props });

	const app = createApp({
		render() {
			return h(SessionBox, {
				...currentProps,
				onStop: (payload) => props.onStop && props.onStop(payload),
				onAdjust: (payload) => props.onAdjust && props.onAdjust(payload),
				onDiscard: () => props.onDiscard && props.onDiscard(),
				onAddLine: (text) => props.onAddLine && props.onAddLine(text),
				onRemoveLine: (idx) => props.onRemoveLine && props.onRemoveLine(idx),
				"onUpdate:notes": (val) => props["onUpdate:notes"] && props["onUpdate:notes"](val),
				"onUpdate:project": (val) => props["onUpdate:project"] && props["onUpdate:project"](val),
				"onUpdate:nature": (val) => props["onUpdate:nature"] && props["onUpdate:nature"](val),
				onBindBlock: (b) => props.onBindBlock && props.onBindBlock(b),
				onUnbindBlock: () => props.onUnbindBlock && props.onUnbindBlock(),
				onToggleElevate: () => props.onToggleElevate && props.onToggleElevate(),
			});
		},
	});

	app.use(FrappeUI);
	app.mount(root);
	sessionBoxInstance = app;

	return {
		app,
		update: updateSessionBox,
	};
}

function updateSessionBox(newProps) {
	if (currentProps) {
		Object.assign(currentProps, newProps);
	}
}

function unmountSessionBox() {
	if (sessionBoxInstance) {
		sessionBoxInstance.unmount();
		sessionBoxInstance = null;
		currentProps = null;
	}
}

const OmniTrackSessionBox = {
	mount: mountSessionBox,
	update: updateSessionBox,
	unmount: unmountSessionBox,
};

if (typeof window !== "undefined") {
	window.OmniTrackSessionBox = OmniTrackSessionBox;
}

export { Vue, FrappeUI, io, OmniTrackSessionBox, SessionBox };
export default OmniTrackSessionBox;
