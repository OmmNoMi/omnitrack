// OmniTrack Service Worker & Web Push Handler
const STATIC_CACHE = 'omnitrack-static-v1.3';
const PRECACHE_ASSETS = [
	'/assets/omnitrack/dist/omnitrack.bundle.css',
	'/assets/omnitrack/dist/omnitrack.bundle.js',
	'/assets/omnitrack/manifest.json',
	'/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg'
];

self.addEventListener('install', function(event) {
	self.skipWaiting();
	event.waitUntil(
		caches.open(STATIC_CACHE).then(function(cache) {
			return cache.addAll(PRECACHE_ASSETS).catch(function(e) { console.warn('PWA precache warning:', e); });
		})
	);
});

self.addEventListener('activate', function(event) {
	event.waitUntil(
		caches.keys().then(function(keys) {
			return Promise.all(
				keys.filter(function(k) { return k !== STATIC_CACHE; }).map(function(k) { return caches.delete(k); })
			);
		}).then(function() {
			return self.clients.claim();
		})
	);
});

self.addEventListener('fetch', function(event) {
	if (event.request.method === 'GET' && event.request.url.includes('/assets/omnitrack/dist/')) {
		event.respondWith(
			caches.match(event.request).then(function(cached) {
				const networkFetch = fetch(event.request).then(function(response) {
					if (response && response.status === 200) {
						const clone = response.clone();
						caches.open(STATIC_CACHE).then(function(cache) {
							cache.put(event.request, clone);
						});
					}
					return response;
				}).catch(function() { return cached; });
				return cached || networkFetch;
			})
		);
	}
});

self.addEventListener('push', function(event) {
	let data = { title: 'OmniTrack Alert', message: 'New task update', url: '/' };
	if (event.data) {
		try {
			data = event.data.json();
		} catch (e) {
			data.message = event.data.text();
		}
	}
	const alertType = data.alert_type || '';
	const isUpcoming10m = alertType === 'upcoming_10m' || (data.title && data.title.includes('In 10 minutes'));
	const isStartOnTime = alertType === 'start_on_time' || (data.title && (data.title.includes('Time to start') || data.title.includes('Start Session')));
	const isSessionAlert = data.is_timer || (data.title && (data.title.includes('Session') || data.title.includes('Overrun') || data.title.includes('Still Working')));

	let actions = [];
	let vibratePattern = [200, 100, 200];

	if (isUpcoming10m) {
		// Gentle double tap for 10m warning
		vibratePattern = [100, 80, 100];
		actions = [
			{ action: 'view_block', title: 'Open in calendar' },
			{ action: 'start_now', title: 'Start now' }
		];
	} else if (isStartOnTime) {
		// Firm attention tap for exact start time
		vibratePattern = [150, 100, 250];
		actions = [
			{ action: 'start_now', title: 'Start session' },
			{ action: 'view_block', title: 'Open in calendar' }
		];
	} else if (isSessionAlert) {
		vibratePattern = [200, 100, 200, 100, 200];
		actions = [
			{ action: 'still_working', title: 'Still working' },
			{ action: 'add_30m', title: 'Add 30 min' },
			{ action: 'stop_session', title: 'Stop' }
		];
	} else {
		actions = [
			{ action: 'view', title: 'View Task' },
			{ action: 'close', title: 'Dismiss' }
		];
	}

	const options = {
		body: data.message,
		icon: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
		badge: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
		data: Object.assign({ url: data.action_url || data.url || '/omnitrack' }, data),
		actions: actions,
		vibrate: vibratePattern
	};
	event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('message', function(event) {
	if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
		const title = event.data.title || 'OmniTrack Alert';
		const alertType = event.data.alert_type || '';
		const isUpcoming10m = alertType === 'upcoming_10m' || title.includes('In 10 minutes');
		const isStartOnTime = alertType === 'start_on_time' || title.includes('Time to start');
		const isTimer = event.data.is_timer || title.includes('Session') || title.includes('Overrun');

		let defaultActions = [];
		let vibratePattern = [200, 100, 200];

		if (isUpcoming10m) {
			vibratePattern = [100, 80, 100];
			defaultActions = [
				{ action: 'view_block', title: 'Open in calendar' },
				{ action: 'start_now', title: 'Start now' }
			];
		} else if (isStartOnTime) {
			vibratePattern = [150, 100, 250];
			defaultActions = [
				{ action: 'start_now', title: 'Start session' },
				{ action: 'view_block', title: 'Open in calendar' }
			];
		} else if (isTimer) {
			vibratePattern = [200, 100, 200, 100, 200];
			defaultActions = [
				{ action: 'still_working', title: 'Still working' },
				{ action: 'add_30m', title: 'Add 30 min' },
				{ action: 'stop_session', title: 'Stop' }
			];
		} else {
			defaultActions = [
				{ action: 'view', title: 'View Task' },
				{ action: 'close', title: 'Dismiss' }
			];
		}

		const options = Object.assign({
			body: 'Timesheet notification',
			icon: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
			badge: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
			data: { url: '/omnitrack' },
			actions: defaultActions,
			vibrate: vibratePattern
		}, event.data.options || {});
		event.waitUntil(self.registration.showNotification(title, options));
	}
});

self.addEventListener('notificationclick', function(event) {
	event.notification.close();
	const action = event.action;
	const nData = (event.notification.data) || {};
	const blockName = nData.block_name || '';

	if (action === 'start_now') {
		const targetUrl = blockName ? `/omnitrack?action=start_block&block=${encodeURIComponent(blockName)}` : '/omnitrack?action=start';
		event.waitUntil(
			fetch('/api/method/omnitrack.api.start_timer', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ block_name: blockName })
			}).catch(function(e) { console.error('Start block timer error:', e); })
			.then(function() {
				return clients.matchAll({ type: 'window', includeUncontrolled: true });
			}).then(function(clientList) {
				for (let client of clientList) {
					if (client.url.includes('/omnitrack') && 'focus' in client) {
						client.postMessage({ type: 'BLOCK_START_FOCUS', block_name: blockName });
						return client.focus();
					}
				}
				if (clients.openWindow) {
					return clients.openWindow(targetUrl);
				}
			})
		);
		return;
	} else if (action === 'view_block') {
		const targetUrl = blockName ? `/omnitrack?action=view_block&block=${encodeURIComponent(blockName)}` : '/omnitrack';
		event.waitUntil(
			clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
				for (let client of clientList) {
					if (client.url.includes('/omnitrack') && 'focus' in client) {
						client.postMessage({ type: 'VIEW_BLOCK_FOCUS', block_name: blockName });
						return client.focus();
					}
				}
				if (clients.openWindow) {
					return clients.openWindow(targetUrl);
				}
			})
		);
		return;
	} else if (action === 'still_working') {
		event.waitUntil(
			fetch('/api/method/omnitrack.api.heartbeat_active_session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			}).catch(function(e) { console.error('Heartbeat push action error:', e); })
			.then(function() {
				return clients.matchAll({ type: 'window', includeUncontrolled: true });
			}).then(function(clientList) {
				for (let client of clientList) {
					if (client.url.includes('/omnitrack') && 'focus' in client) {
						client.postMessage({ type: 'STILL_WORKING_ELEVATE_FOCUS' });
						return client.focus();
					}
				}
				if (clients.openWindow) {
					return clients.openWindow('/omnitrack?action=still_working');
				}
			})
		);
		return;
	} else if (action === 'add_30m') {
		event.waitUntil(
			fetch('/api/method/omnitrack.api.extend_active_block_duration', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ extend_minutes: 30 })
			}).catch(function(e) { console.error('Extend block push action error:', e); })
		);
		return;
	} else if (action === 'stop_session') {
		const targetUrl = '/omnitrack?action=stop';
		event.waitUntil(
			clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
				for (let client of clientList) {
					if (client.url.includes('/omnitrack') && 'focus' in client) {
						client.postMessage({ type: 'REMOTE_STOP_PROMPT' });
						return client.focus();
					}
				}
				if (clients.openWindow) return clients.openWindow(targetUrl);
			})
		);
		return;
	}

	if (action === 'view' || !action) {
		const targetUrl = nData.url || (blockName ? `/omnitrack?action=view_block&block=${encodeURIComponent(blockName)}` : '/omnitrack');
		const notifTitle = (event.notification && event.notification.title) || (nData && nData.title) || '';
		const isStillWorkingAlert = notifTitle.toLowerCase().includes('still working');
		event.waitUntil(
			clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
				for (let client of clientList) {
					if ((client.url.includes('/omnitrack') || client.url === targetUrl) && 'focus' in client) {
						if (isStillWorkingAlert) {
							client.postMessage({ type: 'STILL_WORKING_ELEVATE_FOCUS' });
						}
						return client.focus();
					}
				}
				if (clients.openWindow) {
					const dest = isStillWorkingAlert ? '/omnitrack?action=still_working' : targetUrl;
					return clients.openWindow(dest);
				}
			})
		);
	}
});
