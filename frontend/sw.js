/* Service Worker — Comercializadora de Granos La Herradura
   Muestra notificaciones del sistema aunque la pestaña esté cerrada,
   y abre/enfoca la app al hacer clic en ellas. */

const VAPID_PUBLIC_KEY_URL = '/api/notificaciones/push/vapid-public-key';
const ROTAR_SUSCRIPCION_URL = '/api/notificaciones/push/suscripcion/rotar';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let datos = {};
  let esTextoPlano = false;
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    // El payload no era JSON: mostramos algo igualmente (ver nota abajo)
    // en vez de descartar el push silenciosamente.
    esTextoPlano = true;
    datos = { mensaje: event.data ? event.data.text() : '' };
  }

  const titulo = datos.titulo || 'Comercializadora de Granos La Herradura';
  const tipo = datos.tipo || (esTextoPlano ? 'GENERAL' : 'GENERAL');
  const esUrgente = tipo === 'TAREA_VENCIDA' || tipo === 'TAREA_PROXIMA_VENCER';

  const opciones = {
    body: datos.mensaje || '',
    icon: '/assets/img/favicon-192x192.png',
    badge: '/assets/img/favicon-192x192.png',
    // Agrupa notificaciones de la misma tarea/tipo en una sola y avisa de
    // nuevo (vibra/suena) si llega otra encima en vez de apilar en
    // silencio; sin tag, cada push crea una notificación aparte y en
    // algunos Android eso hace que el sistema las agrupe y silencie.
    tag: datos.tareaId ? `tarea-${datos.tareaId}` : `notif-${tipo}`,
    renotify: true,
    silent: false,
    vibrate: esUrgente ? [200, 100, 200, 100, 200] : [150],
    // Las vencidas/próximas a vencer se quedan visibles hasta que el
    // usuario interactúe, en vez de desaparecer solas a los pocos
    // segundos como el resto.
    requireInteraction: esUrgente,
    timestamp: Date.now(),
    data: { url: datos.url || '/dashboard.html', tareaId: datos.tareaId ?? null },
  };

  // Chrome exige mostrar una notificación por cada push recibido; si el
  // handler termina sin llamar showNotification (por un error no
  // controlado, por ejemplo), el navegador muestra su propio aviso
  // genérico ("Este sitio se actualizó en segundo plano") y, si se repite
  // seguido, puede llegar a revocar el permiso. Por eso el catch de abajo
  // también muestra algo en vez de limitarse a loguear el error.
  event.waitUntil(
    self.registration.showNotification(titulo, opciones).catch((error) => {
      console.error('Error mostrando notificación push:', error);
      return self.registration.showNotification(titulo, {
        body: opciones.body,
        icon: opciones.icon,
        data: opciones.data,
      });
    })
  );
});

// Los navegadores pueden rotar el endpoint de una suscripción push (por
// ejemplo, tras rotar sus propias claves internas) sin que la app esté
// abierta. Si no la re-suscribimos aquí, las notificaciones dejan de
// llegar sin ningún error visible: el backend sigue enviando al endpoint
// viejo, que ya no existe, y sondearNotificacionesFaltantes() en el
// frontend solo cubre el caso de que la pestaña siga abierta. Chrome/Edge
// disparan este evento incluso con la app cerrada; Safari/Firefox son
// menos consistentes, por eso además existe la re-sincronización al
// abrir la app (sincronizarSuscripcionPush en push.js) como red de
// seguridad adicional.
self.addEventListener('pushsubscriptionchange', (event) => {
  const endpointAnterior = event.oldSubscription?.endpoint;

  event.waitUntil(
    (async () => {
      try {
        let nuevaSuscripcion = event.newSubscription;
        if (!nuevaSuscripcion) {
          const respuestaClave = await fetch(VAPID_PUBLIC_KEY_URL);
          const { publicKey } = await respuestaClave.json();
          nuevaSuscripcion = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        if (!endpointAnterior) return; // Sin el endpoint viejo no podemos identificar al usuario.

        const json = nuevaSuscripcion.toJSON();
        await fetch(ROTAR_SUSCRIPCION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpointAnterior,
            endpoint: json.endpoint,
            keys: json.keys,
          }),
        });
      } catch (error) {
        console.error('Error re-suscribiendo push tras pushsubscriptionchange:', error);
      }
    })()
  );
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
