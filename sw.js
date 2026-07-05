// sw.js — Service Worker لاستقبال إشعارات Push حتى لو الموقع مقفول
// لازم يكون في نفس مجلد index.html بالظبط (مش جوه فولدر فرعي)

self.addEventListener('push', function (event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'TAM+', body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'TAM+ 🔔';
  const options = {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './' },
    tag: 'tam-plus',
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// لما المستخدم يدوس على الإشعار — يفتح الموقع (أو يركّز على التاب المفتوح أصلاً)
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));