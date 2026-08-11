/* Service Worker — Comercializadora de Granos La Herradura
   Muestra notificaciones del sistema aunque la pestaña esté cerrada,
   y abre/enfoca la app al hacer clic en ellas. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let datos = {};
  try { datos = event.data ? event.data.json() : {}; } catch { /* payload no era JSON */ }

  const titulo = datos.titulo || 'Comercializadora de Granos La Herradura';
  const opciones = {
    body: datos.mensaje || '',
    icon: '/assets/img/favicon-192x192.png',
    badge: '/assets/img/favicon-192x192.png',
    data: { url: datos.url || '/dashboard.html' },
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
