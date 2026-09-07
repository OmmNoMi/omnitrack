// OmniTrack Universal Client Extension & GitHub Timesheet HUD
frappe.provide('omnitrack');

omnitrack.STORAGE_KEY = 'omnitrack_timer_state_v1';
omnitrack.MODE_KEY = 'omnitrack_hud_mode_v1';
omnitrack.POS_KEY = 'omnitrack_hud_pos_v1';

// Available HUD Positions:
// 'topbar'  : Mount in .page-head / .page-actions (default)
// 'sidebar' : Dock on sidebar border alongside collapse button & assistant help
omnitrack.get_hud_position = function() {
	try {
		return localStorage.getItem(omnitrack.POS_KEY) || 'topbar';
	} catch (e) {
		return 'topbar';
	}
};

omnitrack.set_hud_position = function(pos) {
	try {
		localStorage.setItem(omnitrack.POS_KEY, pos);
	} catch (e) {}
	omnitrack.mount_navbar_timer();
};

// Available HUD Display Modes:
// 'pill'   : Always visible standard widget
// 'zen'    : Unobtrusive 28px micro-dot when idle, auto-expands on hover or active tracking
// 'hidden' : Completely hidden, summonable via Alt+Shift+T or settings
omnitrack.get_hud_mode = function() {
	try {
		return localStorage.getItem(omnitrack.MODE_KEY) || 'pill';
	} catch (e) {
		return 'pill';
	}
};

omnitrack.set_hud_mode = function(mode) {
	try {
		localStorage.setItem(omnitrack.MODE_KEY, mode);
	} catch (e) {}
	omnitrack.apply_hud_mode();
};

omnitrack.apply_hud_mode = function() {
	const mode = omnitrack.get_hud_mode();
	const pos = omnitrack.get_hud_position();
	const $timer = $('#omnitrack-nav-timer');
	if (!$timer.length) return;

	$timer.removeClass('omni-mode-pill omni-mode-zen omni-mode-hidden');
	$timer.addClass('omni-mode-' + mode);

	// Update dropdown checkmarks
	$('.omnitrack-opts-dropdown .omni-opt-item[data-mode]').removeClass('active');
	$('.omnitrack-opts-dropdown .omni-opt-item[data-mode="' + mode + '"]').addClass('active');

	$('.omnitrack-opts-dropdown .omni-opt-item[data-pos]').removeClass('active');
	$('.omnitrack-opts-dropdown .omni-opt-item[data-pos="' + pos + '"]').addClass('active');
};

omnitrack.state = {
	timerActive: false,
	seconds: 0,
	startTime: null,
	timerInterval: null,
	activeProject: null,
	activeTask: null
};

omnitrack.init = function() {
	console.log('[OmniTrack] Initialized v1.0.3 (OmmNoMi Automation LLP)');
	omnitrack.register_service_worker();
	omnitrack.setup_keyboard_shortcuts();
	omnitrack.setup_pwa_navigation();
	omnitrack.restore_timer_state();
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

omnitrack.save_timer_state = function() {
	try {
		localStorage.setItem(omnitrack.STORAGE_KEY, JSON.stringify({
			active: omnitrack.state.timerActive,
			startTime: omnitrack.state.startTime,
			elapsedSeconds: omnitrack.state.seconds,
			savedAt: Date.now()
		}));
	} catch (e) {
		console.warn('[OmniTrack] Failed to save timer state:', e);
	}
};

omnitrack.clear_timer_state = function() {
	try {
		localStorage.removeItem(omnitrack.STORAGE_KEY);
	} catch (e) {}
};

omnitrack.tick = function() {
	if (!omnitrack.state.startTime) return;
	const prevSecs = omnitrack.state.seconds || 0;
	const currentElapsed = Math.floor((Date.now() - omnitrack.state.startTime) / 1000);
	omnitrack.state.seconds = currentElapsed;
	$('#omni-timer-text').text(omnitrack.format_time(currentElapsed));

	// Accessibility feature: In Zen mode, when one more minute rolls over,
	// peek (expand) the timer for exactly 3 seconds so the user is subtly informed
	// without keeping the screen cluttered.
	if (omnitrack.get_hud_mode() === 'zen' && currentElapsed > 0) {
		const prevMin = Math.floor(prevSecs / 60);
		const currMin = Math.floor(currentElapsed / 60);
		if (currMin > prevMin) {
			const $timer = $('#omnitrack-nav-timer');
			$timer.addClass('omni-peek');
			clearTimeout(omnitrack.state.peekTimeout);
			omnitrack.state.peekTimeout = setTimeout(function() {
				$timer.removeClass('omni-peek');
			}, 3000);
		}
	}
};

omnitrack.restore_timer_state = function() {
	try {
		const raw = localStorage.getItem(omnitrack.STORAGE_KEY);
		if (!raw) return;
		const data = JSON.parse(raw);
		if (data && data.active && data.startTime) {
			const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
			omnitrack.state.seconds = Math.max(elapsed, 0);
			omnitrack.state.startTime = data.startTime;
			omnitrack.state.timerActive = true;

			clearInterval(omnitrack.state.timerInterval);
			omnitrack.state.timerInterval = setInterval(omnitrack.tick, 1000);
		}
	} catch (e) {
		console.warn('[OmniTrack] Failed to restore timer state:', e);
	}
};

omnitrack.sync_timer_ui = function() {
	const isRunning = omnitrack.state.timerActive;
	const $timer = $('#omnitrack-nav-timer');

	if (isRunning) {
		$timer.addClass('omni-running');
		$('#omni-timer-dot').addClass('active');
		$('#omni-timer-btn').addClass('stop').text(__('Stop'));
	} else {
		$timer.removeClass('omni-running');
		$('#omni-timer-dot').removeClass('active');
		$('#omni-timer-btn').removeClass('stop').text(__('Punch'));
	}
	$('#omni-timer-text').text(omnitrack.format_time(omnitrack.state.seconds || 0));
	omnitrack.apply_hud_mode();
};

omnitrack.mount_navbar_timer = function() {
	const currentPos = omnitrack.get_hud_position();

	const timerHtml = `
		<div id="omnitrack-nav-timer" class="omni-pos-${currentPos}" title="${__('OmniTrack Live Stopwatch (Alt+Shift+T)')}">
			<div class="omni-timer-pill-inner">
				<span class="omnitrack-timer-dot" id="omni-timer-dot" title="${__('Status Indicator')}"></span>
				<span id="omni-timer-text">00:00:00</span>
				<button type="button" class="omnitrack-timer-action" id="omni-timer-btn">Punch</button>
				<button type="button" class="omnitrack-timer-opts" id="omni-timer-opts-btn" title="${__('Stopwatch Settings')}" aria-haspopup="true">▾</button>
			</div>
			<div class="omnitrack-opts-dropdown" id="omni-timer-dropdown" role="menu" aria-label="${__('Stopwatch Settings')}">
				<div class="omni-opt-header" role="presentation">${__('Timer Location')}</div>
				<div class="omni-opt-item" data-pos="topbar" role="menuitemradio" tabindex="0" aria-label="${__('Top Bar')}">
					<span>${frappe.utils.icon ? frappe.utils.icon('layout', 'xs') : ''} ${__('Top Bar (Header)')}</span>
					<span class="check">✓</span>
				</div>
				<div class="omni-opt-item" data-pos="sidebar" role="menuitemradio" tabindex="-1" aria-label="${__('Sidebar Border')}">
					<span>${frappe.utils.icon ? frappe.utils.icon('sidebar', 'xs') : ''} ${__('Sidebar Border (Hover)')}</span>
					<span class="check">✓</span>
				</div>
				<div class="omni-opt-header" role="presentation" style="margin-top:6px;">${__('Timer Style')}</div>
				<div class="omni-opt-item" data-mode="pill" role="menuitemradio" tabindex="-1" aria-label="${__('Always Visible')}">
					<span>${frappe.utils.icon ? frappe.utils.icon('eye', 'xs') : ''} ${__('Always Visible')}</span>
					<span class="check">✓</span>
				</div>
				<div class="omni-opt-item" data-mode="zen" role="menuitemradio" tabindex="-1" aria-label="${__('Zen Dot (Hover to see time)')}">
					<span>${frappe.utils.icon ? frappe.utils.icon('minimize-2', 'xs') : ''} ${__('Zen Dot (Hover to see time)')}</span>
					<span class="check">✓</span>
				</div>
				<div class="omni-opt-item" data-mode="hidden" role="menuitemradio" tabindex="-1" aria-label="${__('Hidden (On-Demand)')}">
					<span>${frappe.utils.icon ? frappe.utils.icon('eye-off', 'xs') : ''} ${__('Hidden (On-Demand)')}</span>
					<span class="check">✓</span>
				</div>
			</div>
		</div>
	`;

	const $existing = $('#omnitrack-nav-timer');

	if (currentPos === 'sidebar') {
		// Dock on sidebar boundary
		const $sidebar = $('.body-sidebar').first();
		if ($sidebar.length) {
			if ($existing.length) {
				$existing.removeClass('omnitrack-floating omni-pos-topbar').addClass('omni-pos-sidebar');
				if (!$sidebar.has($existing).length) {
					$existing.appendTo($sidebar);
				}
			} else {
				$(timerHtml).appendTo($sidebar);
			}
		} else {
			// Fallback if sidebar not loaded yet
			if ($existing.length) {
				$existing.addClass('omnitrack-floating').appendTo('body');
			} else {
				$(timerHtml).addClass('omnitrack-floating').appendTo('body');
			}
		}
	} else {
		// Topbar placement inside .page-actions
		const $pageActions = $('.page-head:visible .page-actions, .page-container:visible:not(.hide) .page-head .page-actions, .page-actions:visible').first();
		if ($pageActions.length) {
			if ($existing.length) {
				$existing.removeClass('omnitrack-floating omni-pos-sidebar').addClass('omni-pos-topbar');
				if (!$pageActions.has($existing).length) {
					$existing.prependTo($pageActions);
				}
			} else {
				$(timerHtml).prependTo($pageActions);
			}
		} else {
			if ($existing.length) {
				$existing.removeClass('omni-pos-sidebar').addClass('omnitrack-floating omni-pos-topbar').appendTo('body');
			} else {
				$(timerHtml).addClass('omnitrack-floating omni-pos-topbar').appendTo('body');
			}
		}
	}

	omnitrack.sync_timer_ui();

	// Options dropdown trigger
	$('#omni-timer-opts-btn').off('click').on('click', function(e) {
		e.stopPropagation();
		e.preventDefault();
		const $dd = $('#omni-timer-dropdown');
		const isOpen = $dd.hasClass('show');
		if (isOpen) {
			$dd.removeClass('show');
			$('#omnitrack-nav-timer').removeClass('omni-dock-open');
			$('#omni-timer-opts-btn').focus();
		} else {
			$dd.addClass('show');
			$('#omnitrack-nav-timer').addClass('omni-dock-open');
			// Focus active item or first item
			const $activeItem = $dd.find('.omni-opt-item.active').first();
			const $focusTarget = $activeItem.length ? $activeItem : $dd.find('.omni-opt-item').first();
			$focusTarget.focus();
		}
	});

	// Dropdown keyboard navigation (ArrowUp / ArrowDown / Enter / Space / Escape)
	$('#omni-timer-dropdown').off('keydown').on('keydown', function(e) {
		const $items = $(this).find('.omni-opt-item:visible');
		const count = $items.length;
		if (!count) return;

		let curIdx = $items.index(document.activeElement);
		if (curIdx === -1) curIdx = 0;

		if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
			e.preventDefault();
			e.stopPropagation();
			const nextIdx = (curIdx + 1) % count;
			$items.eq(nextIdx).focus();
		} else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
			e.preventDefault();
			e.stopPropagation();
			const prevIdx = (curIdx - 1 + count) % count;
			$items.eq(prevIdx).focus();
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			e.stopPropagation();
			if (curIdx >= 0) {
				$items.eq(curIdx).click();
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			$('#omni-timer-dropdown').removeClass('show');
			$('#omnitrack-nav-timer').removeClass('omni-dock-open');
			$('#omni-timer-opts-btn').focus();
		}
	});

	// Position item selection
	$('.omnitrack-opts-dropdown .omni-opt-item[data-pos]').off('click').on('click', function(e) {
		e.stopPropagation();
		e.preventDefault();
		const targetPos = $(this).attr('data-pos');
		$('#omni-timer-dropdown').removeClass('show');
		$('#omnitrack-nav-timer').removeClass('omni-dock-open');
		omnitrack.set_hud_position(targetPos);

		let posLabel = targetPos === 'sidebar' ? __('Sidebar Border') : __('Top Bar');
		frappe.show_alert({
			message: __('Timer location set to: ') + '<strong>' + posLabel + '</strong>',
			indicator: 'blue'
		}, 3);
	});

	// Mode item selection
	$('.omnitrack-opts-dropdown .omni-opt-item[data-mode]').off('click').on('click', function(e) {
		e.stopPropagation();
		e.preventDefault();
		const targetMode = $(this).attr('data-mode');
		omnitrack.set_hud_mode(targetMode);
		$('#omni-timer-dropdown').removeClass('show');
		$('#omnitrack-nav-timer').removeClass('omni-dock-open');

		let label = targetMode === 'zen' ? __('Zen Dot (Hover to see time)') : (targetMode === 'hidden' ? __('Hidden (Press Alt+Shift+T to summon)') : __('Always Visible'));
		frappe.show_alert({
			message: __('Timer style set to: ') + '<strong>' + label + '</strong>',
			indicator: 'blue'
		}, 3);

		$('#omni-timer-opts-btn').focus();
	});

	// Close dropdown when clicking outside
	$(document).off('click.omni_dd').on('click.omni_dd', function(e) {
		if (!$(e.target).closest('#omnitrack-nav-timer').length) {
			$('#omni-timer-dropdown').removeClass('show');
			$('#omnitrack-nav-timer').removeClass('omni-dock-open');
		}
	});

	$('#omni-timer-btn').off('click').on('click', function(e) {
		e.stopPropagation();
		e.preventDefault();
		omnitrack.toggle_timer();
	});

	$('#omnitrack-nav-timer').off('click').on('click', function(e) {
		if (e.target && (e.target.id === 'omni-timer-btn' || e.target.id === 'omni-timer-opts-btn' || $(e.target).closest('.omnitrack-opts-dropdown').length)) return;
		omnitrack.toggle_timer();
	});
};

omnitrack.toggle_timer = function() {
	// If timer was hidden, make it temporarily visible when user invokes it
	if (omnitrack.get_hud_mode() === 'hidden') {
		$('#omnitrack-nav-timer').removeClass('omni-mode-hidden');
	}

	if (omnitrack.state.timerActive) {
		// Stop / Punch OUT -> Open Dialog
		const loggedSecs = omnitrack.state.seconds;
		const formatted = omnitrack.format_time(loggedSecs);
		
		// Temporarily pause ticking while dialog is open
		clearInterval(omnitrack.state.timerInterval);

		let saved = false;

		const d = new frappe.ui.Dialog({
			title: __('⏱️ Save Work Block (' + formatted + ')'),
			fields: [
				{
					label: __('Work Nature'),
					fieldname: 'work_nature',
					fieldtype: 'Select',
					options: ['🎯 Planned', '⚠️ Unplanned', '👥 Review', '☕ Break'],
					default: '🎯 Planned',
					reqd: 1
				},
				{
					label: __('Project'),
					fieldname: 'project',
					fieldtype: 'Link',
					options: 'Project',
					change() {
						const proj = d.get_value('project');
						d.set_value('task', '');
					}
				},
				{
					label: __('Associated Task'),
					fieldname: 'task',
					fieldtype: 'Link',
					options: 'Task',
					get_query() {
						const proj = d.get_value('project');
						if (proj) {
							return { filters: { project: proj } };
						}
						return {};
					}
				},
				{
					label: __('Deliverable & Handoff Notes'),
					fieldname: 'deliverable_notes',
					fieldtype: 'Small Text',
					placeholder: __('Summary of what was completed during this work session...')
				}
			],
			primary_action_label: __('Save Work Block'),
			primary_action(values) {
				saved = true;
				frappe.call({
					method: 'omnitrack.api.quick_timer_punch',
					args: {
						action: 'stop',
						duration_seconds: loggedSecs,
						work_nature: values.work_nature,
						project: values.project,
						task: values.task,
						deliverable_notes: values.deliverable_notes
					},
					freeze: true,
					freeze_message: __('Saving Work Block...'),
					callback: function(r) {
						if (r.message && r.message.status === 'success') {
							frappe.show_alert({
								message: __('✅ ' + r.message.message + ' [' + (r.message.cryptographic_hash || '').substring(0, 10) + '...]'),
								indicator: 'green'
							}, 7);

							omnitrack.state.timerActive = false;
							omnitrack.state.seconds = 0;
							omnitrack.state.startTime = null;
							omnitrack.clear_timer_state();
							omnitrack.sync_timer_ui();
						}
						d.hide();
					}
				});
			},
			secondary_action_label: __('Resume Timer'),
			secondary_action() {
				omnitrack.resume_timer(loggedSecs);
				d.hide();
			}
		});

		// Custom Discard button with explicit styling & crisp label
		const discardHandler = function() {
			frappe.confirm(__('Are you sure you want to discard this timer session without saving?'), function() {
				saved = true;
				omnitrack.state.timerActive = false;
				omnitrack.state.seconds = 0;
				omnitrack.state.startTime = null;
				omnitrack.clear_timer_state();
				omnitrack.sync_timer_ui();
				frappe.show_alert({ message: __('Timer session discarded'), indicator: 'orange' });
				d.hide();
			});
		};

		if (typeof d.add_custom_action === 'function') {
			d.add_custom_action(__('Discard'), discardHandler, 'btn-danger');
		} else if (typeof d.add_custom_button === 'function') {
			const $btn = d.add_custom_button(__('Discard'), discardHandler);
			if ($btn && $btn.addClass) $btn.addClass('btn-danger');
		}

		// Ensure Discard button has explicit text and styling
		setTimeout(function() {
			const $discardBtn = d.$wrapper.find('.modal-footer button:contains("Discard"), .modal-footer .btn-danger');
			if ($discardBtn.length) {
				$discardBtn.text(__('Discard')).css({
					'color': '#ffffff',
					'background-color': '#da3633',
					'border-color': '#da3633',
					'padding': '4px 12px',
					'font-weight': '600'
				});
			}
		}, 50);

		// Handle dialog dismiss/close without action -> resume timer
		d.$wrapper.on('hidden.bs.modal', function() {
			if (!saved && omnitrack.state.timerActive) {
				omnitrack.resume_timer(loggedSecs);
			}
		});

		d.show();

	} else {
		// Start Timer & Punch IN
		omnitrack.state.timerActive = true;
		omnitrack.state.seconds = 0;
		omnitrack.state.startTime = Date.now();
		omnitrack.save_timer_state();
		omnitrack.sync_timer_ui();

		frappe.call({
			method: 'omnitrack.api.quick_timer_punch',
			args: { action: 'punch_in' },
			callback: function(r) {
				frappe.show_alert({ message: __('🚀 OmniTrack Stopwatch Started'), indicator: 'green' });
			}
		});
		
		clearInterval(omnitrack.state.timerInterval);
		omnitrack.state.timerInterval = setInterval(omnitrack.tick, 1000);
	}
};

omnitrack.resume_timer = function(loggedSecs) {
	omnitrack.state.timerActive = true;
	omnitrack.state.startTime = Date.now() - ((loggedSecs || 0) * 1000);
	omnitrack.save_timer_state();
	clearInterval(omnitrack.state.timerInterval);
	omnitrack.state.timerInterval = setInterval(omnitrack.tick, 1000);
	omnitrack.sync_timer_ui();
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
		// Alt+Shift+T (Option+Shift+T on Mac) prevents overriding browser's Cmd+Shift+T / Ctrl+Shift+T (Reopen Tab)
		if (e.altKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
			e.preventDefault();
			omnitrack.toggle_timer();
		}
	});
};

omnitrack.setup_pwa_navigation = function() {
	// Robust navigation handler for PWA Workstation shortcuts and sidebar items (capture phase bypasses popup blockers)
	document.addEventListener('click', function(e) {
		const pwaTarget = e.target.closest && e.target.closest(
			'.shortcut-widget-box[aria-label*="PWA"], .shortcut-widget-box[data-label*="PWA"], [data-id*="PWA"], [item-name*="PWA"], a[href="/omnitrack"]'
		);
		if (!pwaTarget) return;

		// If user deliberately held metaKey or ctrlKey, open in new tab
		if (e.metaKey || e.ctrlKey || e.button === 1) {
			window.open('/omnitrack', '_blank');
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		// Normal click: navigate directly to PWA Workstation on same page
		e.preventDefault();
		e.stopPropagation();
		window.location.href = '/omnitrack';
	}, true);

	// Keyboard accessibility (Enter / Space on shortcut box)
	document.addEventListener('keydown', function(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			const el = document.activeElement;
			if (el && el.closest) {
				const pwaTarget = el.closest(
					'.shortcut-widget-box[aria-label*="PWA"], .shortcut-widget-box[data-label*="PWA"], [data-id*="PWA"], [item-name*="PWA"], a[href="/omnitrack"]'
				);
				if (pwaTarget) {
					e.preventDefault();
					e.stopPropagation();
					if (e.metaKey || e.ctrlKey) {
						window.open('/omnitrack', '_blank');
					} else {
						window.location.href = '/omnitrack';
					}
				}
			}
		}
	}, true);

	// Ensure PWA icon is rendered if icon container is blank
	function renderPwaIcons() {
		$('[item-name="PWA Workstation"] .sidebar-item-icon').each(function() {
			if ($(this).find('svg').length === 0) {
				$(this).html(frappe.utils.icon('smartphone', 'sm', '', '', 'text-ink-gray-7 current-color', true));
			}
		});
	}
	renderPwaIcons();
	$(document).on('page_change toolbar_setup', renderPwaIcons);
};

$(document).ready(function() {
	omnitrack.init();
});

$(document).on('toolbar_setup page_change page-change', function() {
	omnitrack.mount_navbar_timer();
});

if (frappe.router && frappe.router.on) {
	frappe.router.on('change', function() {
		setTimeout(omnitrack.mount_navbar_timer, 150);
	});
}
