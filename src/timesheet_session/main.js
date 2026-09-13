import { createApp, reactive, h } from "vue";
import { FrappeUI } from "frappe-ui";
import "frappe-ui/style.css";
import "./styles.css";
import SessionBox from "./SessionBox.vue";

let appInstance = null;
let currentProps = null;

function mount(target, props = {}) {
	const container = typeof target === "string" ? document.querySelector(target) : target;
	if (!container) {
		console.error("[OmniTrackSessionBox] Container not found:", target);
		return null;
	}

	if (appInstance) {
		unmount();
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
	appInstance = app;

	return {
		app,
		update,
	};
}

function update(newProps) {
	if (currentProps) {
		Object.assign(currentProps, newProps);
	}
}

function unmount() {
	if (appInstance) {
		appInstance.unmount();
		appInstance = null;
		currentProps = null;
	}
	const root = document.getElementById("omnitrack-session-box-root");
	if (root) {
		root.remove();
	}
}

window.OmniTrackSessionBox = { mount, update, unmount };
export { mount, update, unmount };
