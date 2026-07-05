// sw.js — Service Worker لإشعارات TAM+
// هذا الملف بيفضل شغال في الخلفية من المتصفح حتى لو الموقع والتاب مقفولين تماماً،
// وده اللي بيسمح بظهور إشعار حقيقي زي تطبيقات الموبايل (واتساب مثلاً).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// لما يوصل push من السيرفر (Supabase Edge Function) عبر خدمة Push بتاعة المتصفح
self.addEventListener('push', (event) => {
  let data = { title: 'TAM+', body: 'إشعار جديد', url: './' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'tam-plus',
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
    data: { url: data.url || './' },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// لما المستخدم يدوس على الإشعار — يفتح الموقع (أو يركز التاب المفتوح لو موجود)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});