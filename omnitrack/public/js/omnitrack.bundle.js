// OmniTrack Universal Client Extension
frappe.provide('omnitrack');

omnitrack.init = function() {
	console.log('[OmniTrack] Initialized v1.0.0 (OmmNoMi Automation LLP)');
	omnitrack.register_service_worker();
	omnitrack.setup_keyboard_shortcuts();
};

omnitrack.register_service_worker = function() {
	if ('serviceWorker' in navigator && 'PushManager' in window) {
		navigator.serviceWorker.register('/assets/omnitrack/sw.js')
			.then(function(reg) {
				// SW registered
			})
			.catch(function(err) {
				console.warn('[OmniTrack] SW registration skipped:', err);
			});
	}
};

omnitrack.setup_keyboard_shortcuts = function() {
	$(document).on('keydown', function(e) {
		// Cmd+K or Ctrl+K Quick HUD
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			// Focus search or HUD
		}
	});
};

$(document).ready(function() {
	omnitrack.init();
});
