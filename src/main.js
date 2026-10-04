import * as Vue from "vue";
import { createApp, reactive, h } from "vue";
import { FrappeUI } from "frappe-ui";
import { io } from "socket.io-client";
import "frappe-ui/style.css";
import "./styles/main.css";
import App from "./App.vue";
import SessionBox from "./session/SessionBox.vue";
import FDropdownMenu from "./components/common/FDropdownMenu.vue";
import FCombobox from "./components/common/FCombobox.vue";
import BookWorkBlockModal from "./components/dialogs/BookWorkBlockModal.vue";
import InactivityGovernorModal from "./components/dialogs/InactivityGovernorModal.vue";
import AdjustTimingModal from "./components/dialogs/AdjustTimingModal.vue";
import EmptyStopModal from "./components/dialogs/EmptyStopModal.vue";
import StartTimeChoiceModal from "./components/dialogs/StartTimeChoiceModal.vue";
import RunawayTimerModal from "./components/dialogs/RunawayTimerModal.vue";
import EODWrapUpModal from "./components/dialogs/EODWrapUpModal.vue";
import SwitchTaskModal from "./components/dialogs/SwitchTaskModal.vue";
import WrapAndStartNextModal from "./components/dialogs/WrapAndStartNextModal.vue";
import CancelWorkBlockModal from "./components/dialogs/CancelWorkBlockModal.vue";
import EditSessionModal from "./components/dialogs/EditSessionModal.vue";
import BlockDetailDrawer from "./drawers/BlockDetailDrawer.vue";
import RavenCollaborationDrawer from "./drawers/RavenCollaborationDrawer.vue";
import DashboardView from "./views/DashboardView.vue";
import CalendarView from "./views/CalendarView.vue";
import TimesheetsView from "./views/TimesheetsView.vue";
import AttendanceView from "./views/AttendanceView.vue";

// Expose Vue, Frappe UI, and Socket.io globally for zero-CDN workstation operation
if (typeof window !== "undefined") {
	window.Vue = Vue;
	window.FrappeUI = FrappeUI;
	window.io = io;
	window.OmniTrackComponents = {
		App,
		SessionBox,
		FDropdownMenu,
		FCombobox,
		BookWorkBlockModal,
		InactivityGovernorModal,
		AdjustTimingModal,
		EmptyStopModal,
		StartTimeChoiceModal,
		RunawayTimerModal,
		EODWrapUpModal,
		SwitchTaskModal,
		WrapAndStartNextModal,
		CancelWorkBlockModal,
		EditSessionModal,
		BlockDetailDrawer,
		RavenCollaborationDrawer,
		DashboardView,
		CalendarView,
		TimesheetsView,
		AttendanceView
	};
}

let sessionBoxInstance = null;
let currentProps = null;
let spaAppInstance = null;

function mountApp(target = "#app") {
	const container = typeof target === "string" ? document.querySelector(target) : target;
	if (!container) {
		console.warn("[OmniTrack] App container not found:", target);
		return null;
	}

	if (spaAppInstance) {
		spaAppInstance.unmount();
	}

	container.innerHTML = "";
	const app = createApp(App);
	app.use(FrappeUI);
	app.component("FDropdownMenu", FDropdownMenu);
	app.component("f-dropdown-menu", FDropdownMenu);
	app.component("FCombobox", FCombobox);
	app.component("f-combobox", FCombobox);
	app.component("SessionBox", SessionBox);
	app.component("BookWorkBlockModal", BookWorkBlockModal);
	app.component("InactivityGovernorModal", InactivityGovernorModal);
	app.component("AdjustTimingModal", AdjustTimingModal);
	app.component("EmptyStopModal", EmptyStopModal);
	app.component("StartTimeChoiceModal", StartTimeChoiceModal);
	app.component("RunawayTimerModal", RunawayTimerModal);
	app.component("EODWrapUpModal", EODWrapUpModal);
	app.component("SwitchTaskModal", SwitchTaskModal);
	app.component("WrapAndStartNextModal", WrapAndStartNextModal);
	app.component("CancelWorkBlockModal", CancelWorkBlockModal);
	app.component("EditSessionModal", EditSessionModal);
	app.component("BlockDetailDrawer", BlockDetailDrawer);
	app.component("RavenCollaborationDrawer", RavenCollaborationDrawer);
	app.component("DashboardView", DashboardView);
	app.component("CalendarView", CalendarView);
	app.component("TimesheetsView", TimesheetsView);
	app.component("AttendanceView", AttendanceView);

	app.mount(container);
	spaAppInstance = app;
	return app;
}

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
	}
	sessionBoxInstance = null;
	currentProps = null;
}

const OmniTrackSessionBox = {
	mount: mountSessionBox,
	update: updateSessionBox,
	unmount: unmountSessionBox,
};

if (typeof window !== "undefined") {
	window.OmniTrackSessionBox = OmniTrackSessionBox;
	window.OmniTrack = {
		mountApp,
		App,
		SessionBox,
		FDropdownMenu,
		FCombobox
	};

	// Auto-mount SPA if empty shell container #app is detected
	if (typeof document !== "undefined") {
		const autoInit = () => {
			const el = document.getElementById("app");
			if (el && el.children.length === 0 && window.omnitrack_boot && !window.__omnitrack_spa_mounted__) {
				window.__omnitrack_spa_mounted__ = true;
				mountApp(el);
			}
		};
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", autoInit);
		} else {
			autoInit();
		}
	}
}

export { Vue, FrappeUI, io, OmniTrackSessionBox, SessionBox, App, FDropdownMenu, FCombobox, mountApp };
export default OmniTrackSessionBox;
