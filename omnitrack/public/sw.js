// OmniTrack Service Worker & Web Push Handler
self.addEventListener('install', function(event) {
	self.skipWaiting();
});

self.addEventListener('activate', function(event) {
	event.waitUntil(self.clients.claim());
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
	const isSessionAlert = data.is_timer || (data.title && (data.title.includes('Session') || data.title.includes('Overrun') || data.title.includes('Still Working')));
	const actions = isSessionAlert ? [
		{ action: 'still_working', title: '⏱️ Still Working' },
		{ action: 'add_30m', title: '➕ +30m' },
		{ action: 'stop_session', title: '⏹️ Stop' }
	] : [
		{ action: 'view', title: 'View Task' },
		{ action: 'close', title: 'Dismiss' }
	];

	const options = {
		body: data.message,
		icon: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
		badge: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
		data: Object.assign({ url: data.url || '/omnitrack' }, data),
		actions: actions,
		vibrate: [200, 100, 200]
	};
	event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('message', function(event) {
	if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
		const title = event.data.title || 'OmniTrack Alert';
		const isTimer = event.data.is_timer || title.includes('Session') || title.includes('Overrun');
		const defaultActions = isTimer ? [
			{ action: 'still_working', title: '⏱️ Still Working' },
			{ action: 'add_30m', title: '➕ +30m' },
			{ action: 'stop_session', title: '⏹️ Stop' }
		] : [
			{ action: 'view', title: 'View Task' },
			{ action: 'close', title: 'Dismiss' }
		];

		const options = Object.assign({
			body: 'Timesheet notification',
			icon: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
			badge: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
			data: { url: '/omnitrack' },
			actions: defaultActions,
			vibrate: [200, 100, 200, 100, 200]
		}, event.data.options || {});
		event.waitUntil(self.registration.showNotification(title, options));
	}
});

self.addEventListener('notificationclick', function(event) {
	event.notification.close();
	const action = event.action;
	const nData = (event.notification.data) || {};

	if (action === 'still_working') {
		event.waitUntil(
			fetch('/api/method/omnitrack.api.heartbeat_active_session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			}).catch(function(e) { console.error('Heartbeat push action error:', e); })
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
		const targetUrl = nData.url || '/omnitrack';
		event.waitUntil(
			clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
				for (let client of clientList) {
					if ((client.url.includes('/omnitrack') || client.url === targetUrl) && 'focus' in client) {
						return client.focus();
					}
				}
				if (clients.openWindow) {
					return clients.openWindow(targetUrl);
				}
			})
		);
	}
});
