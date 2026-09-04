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
	const options = {
		body: data.message,
		icon: '/assets/omnitrack/images/omnitrack-icon.png',
		badge: '/assets/omnitrack/images/omnitrack-badge.png',
		data: { url: data.url || '/' },
		actions: [
			{ action: 'view', title: 'View Task' },
			{ action: 'close', title: 'Dismiss' }
		]
	};
	event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function(event) {
	event.notification.close();
	if (event.action === 'view' || !event.action) {
		const targetUrl = (event.notification.data && event.notification.data.url) || '/';
		event.waitUntil(
			clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
				for (let client of clientList) {
					if (client.url === targetUrl && 'focus' in client) {
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
