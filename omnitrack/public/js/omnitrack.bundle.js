// OmniTrack Universal Client Extension & Live Desk HUD
frappe.provide('omnitrack');

omnitrack.state = {
	timerActive: false,
	seconds: 0,
	timerInterval: null
};

omnitrack.init = function() {
	console.log('[OmniTrack] Initialized v1.0.1 (OmmNoMi Automation LLP)');
	omnitrack.register_service_worker();
	omnitrack.setup_keyboard_shortcuts();
	omnitrack.mount_navbar_timer();
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

omnitrack.mount_navbar_timer = function() {
	// Mount persistent timer HUD into Frappe Desk navbar
	if ($('#omnitrack-nav-timer').length > 0) return;

	const timerHtml = `
		<div id="omnitrack-nav-timer" title="OmniTrack Live Stopwatch (Click to toggle)">
			<span class="omnitrack-timer-dot" id="omni-timer-dot"></span>
			<span id="omni-timer-text">00:00:00</span>
			<button class="omnitrack-timer-action" id="omni-timer-btn">Punch</button>
		</div>
	`;

	const $target = $('.navbar .navbar-nav, .nav-right, .navbar-collapse .nav').first();
	if ($target.length) {
		$target.prepend(timerHtml);
	} else {
		$('header.navbar').append(timerHtml);
	}

	$('#omni-timer-btn').on('click', function(e) {
		e.stopPropagation();
		omnitrack.toggle_timer();
	});

	$('#omnitrack-nav-timer').on('click', function() {
		omnitrack.toggle_timer();
	});
};

omnitrack.toggle_timer = function() {
	if (omnitrack.state.timerActive) {
		// Stop Timer
		clearInterval(omnitrack.state.timerInterval);
		omnitrack.state.timerActive = false;
		$('#omni-timer-dot').removeClass('active');
		$('#omni-timer-btn').removeClass('stop').text('Punch');
		frappe.show_alert({ message: __('⏱️ OmniTrack Stopwatch paused: ' + omnitrack.format_time(omnitrack.state.seconds)), indicator: 'blue' });
	} else {
		// Start Timer
		omnitrack.state.timerActive = true;
		$('#omni-timer-dot').addClass('active');
		$('#omni-timer-btn').addClass('stop').text('Stop');
		frappe.show_alert({ message: __('🚀 OmniTrack Stopwatch started'), indicator: 'green' });
		
		omnitrack.state.timerInterval = setInterval(function() {
			omnitrack.state.seconds++;
			$('#omni-timer-text').text(omnitrack.format_time(omnitrack.state.seconds));
		}, 1000);
	}
};

omnitrack.format_time = function(totalSeconds) {
	const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
	const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
	const secs = String(totalSeconds % 60).padStart(2, '0');
	return `${hrs}:${mins}:${secs}`;
};

omnitrack.setup_keyboard_shortcuts = function() {
	$(document).on('keydown', function(e) {
		// Ctrl+Shift+T or Cmd+Shift+T to toggle timer
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'T' || e.key === 't')) {
			e.preventDefault();
			omnitrack.toggle_timer();
		}
	});
};

$(document).ready(function() {
	omnitrack.init();
});

$(document).on('toolbar_setup', function() {
	omnitrack.mount_navbar_timer();
});
