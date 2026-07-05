// ================================================================
//  TAM+ Service Worker — لازم يتحط في نفس مجلد index.html بالظبط
//  (يعني: yourapp.com/sw.js — مش جوه فولدر فرعي)
// ================================================================

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// لما يوصل Push حقيقي من السيرفر (حتى والموقع مقفول)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'TAM+', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'TAM+ 🔔';
  const options = {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './' },
    tag: 'tam-plus-' + Date.now(), // tag فريد عشان الإشعارات المختلفة متبقاش بتلغي بعض
    renotify: true,
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// لما المستخدم يدوس على الإشعار — يفتحله الموقع
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});