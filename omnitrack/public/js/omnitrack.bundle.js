// OmniTrack Universal Client Extension & GitHub Timesheet HUD
frappe.provide('omnitrack');

omnitrack.state = {
	timerActive: false,
	seconds: 0,
	timerInterval: null,
	activeProject: null,
	activeTask: null
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
			.then(function(reg) {})
			.catch(function(err) {
				console.warn('[OmniTrack] SW registration skipped:', err);
			});
	}
};

omnitrack.mount_navbar_timer = function() {
	if ($('#omnitrack-nav-timer').length > 0) return;

	const timerHtml = `
		<div id="omnitrack-nav-timer" title="OmniTrack Live Stopwatch (Click to toggle or punch)">
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
		// Prompt to save time log
		const loggedSecs = omnitrack.state.seconds;
		const formatted = omnitrack.format_time(loggedSecs);
		
		clearInterval(omnitrack.state.timerInterval);
		omnitrack.state.timerActive = false;
		$('#omni-timer-dot').removeClass('active');
		$('#omni-timer-btn').removeClass('stop').text('Punch');

		// Open Save Dialog
		const d = new frappe.ui.Dialog({
			title: __('⏱️ Save Work Block (' + formatted + ')'),
			fields: [
				{
					label: __('Project'),
					fieldname: 'project',
					fieldtype: 'Link',
					options: 'Project'
				},
				{
					label: __('Associated Task'),
					fieldname: 'task',
					fieldtype: 'Link',
					options: 'Task'
				},
				{
					label: __('Deliverable & Handoff Notes'),
					fieldname: 'deliverable_notes',
					fieldtype: 'Small Text',
					placeholder: __('Summary of what was completed...')
				}
			],
			primary_action_label: __('Save Work Block'),
			primary_action(values) {
				frappe.call({
					method: 'omnitrack.api.quick_timer_punch',
					args: {
						action: 'stop',
						duration_seconds: loggedSecs,
						project: values.project,
						task: values.task,
						deliverable_notes: values.deliverable_notes
					},
					callback: function(r) {
						if (r.message && r.message.status === 'success') {
							frappe.show_alert({ message: __('✅ ' + r.message.message + ' [' + (r.message.cryptographic_hash || '') + ']'), indicator: 'green' });
							omnitrack.state.seconds = 0;
							$('#omni-timer-text').text('00:00:00');
						}
						d.hide();
					}
				});
			}
		});
		d.show();

	} else {
		// Start Timer & Punch IN
		omnitrack.state.timerActive = true;
		$('#omni-timer-dot').addClass('active');
		$('#omni-timer-btn').addClass('stop').text('Stop');

		frappe.call({
			method: 'omnitrack.api.quick_timer_punch',
			args: { action: 'punch_in' },
			callback: function(r) {
				frappe.show_alert({ message: __('🚀 OmniTrack Stopwatch Started'), indicator: 'green' });
			}
		});
		
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

omnitrack.render_heatmap = function(containerSelector, days=30) {
	const $container = $(containerSelector);
	if (!$container.length) return;

	$container.html('<div class="omnitrack-loading">Loading Contribution Heatmap...</div>');

	frappe.call({
		method: 'omnitrack.api.get_user_heatmap_data',
		args: { days: days },
		callback: function(r) {
			if (!r.message) return;
			const data = r.message;
			let cellsHtml = '';
			data.matrix.forEach(function(item) {
				cellsHtml += `
					<div class="omnitrack-heatmap-cell" style="background: ${item.color}" title="${item.date} (${item.day_name}): ${item.hours}h • ${item.badge}">
						<span class="omnitrack-tooltip">${item.date} (${item.day_name})<br><strong>${item.hours} hrs</strong> • ${item.status}</span>
					</div>
				`;
			});

			const heatmapHtml = `
				<div class="omnitrack-heatmap-card">
					<div class="omnitrack-heatmap-header">
						<div class="omnitrack-heatmap-title">
							<strong>📊 Contribution Streak (${days} Days)</strong>
							<span class="omnitrack-badge omnitrack-badge-present">🔥 ${data.current_streak} Day Streak</span>
						</div>
						<div class="omnitrack-heatmap-stats">
							<span>Total: <strong>${data.total_hours}h</strong></span>
							<span>Avg: <strong>${data.average_daily_hours}h/day</strong></span>
						</div>
					</div>
					<div class="omnitrack-heatmap-grid">
						${cellsHtml}
					</div>
					<div class="omnitrack-heatmap-footer">
						<span class="text-muted text-xs">Less</span>
						<span class="omnitrack-legend-cell" style="background: #161b22"></span>
						<span class="omnitrack-legend-cell" style="background: #0e4429"></span>
						<span class="omnitrack-legend-cell" style="background: #006d32"></span>
						<span class="omnitrack-legend-cell" style="background: #26a641"></span>
						<span class="omnitrack-legend-cell" style="background: #39d353"></span>
						<span class="text-muted text-xs">More</span>
					</div>
				</div>
			`;
			$container.html(heatmapHtml);
		}
	});
};

omnitrack.setup_keyboard_shortcuts = function() {
	$(document).on('keydown', function(e) {
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'T' || e.key === 't')) {
			e.preventDefault();
			omnitrack.toggle_timer();
		}
	});
};

$(document).ready(function() {
	omnitrack.init();
});

$(document).on('toolbar_setup page_change', function() {
	omnitrack.mount_navbar_timer();
});
