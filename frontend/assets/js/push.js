/**
 * Comercializadora de Granos La Herradura — Notificaciones push (escritorio y teléfono)
 */
'use strict';

import { apiRequest } from './api.config.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function soportaPush() {
  return ('serviceWorker' in navigator) && ('PushManager' in window);
}

// Registrar el SW es idempotente y no requiere permiso: conviene hacerlo
// en cuanto arranca la app (no solo al pulsar "Activar notificaciones"),
// para que quede activo y controlando la página lo antes posible. Un SW
// que solo se registra tras un clic tarda en "tomar control" y puede
// perderse el evento pushsubscriptionchange si el navegador rota la
// suscripción antes de que el usuario vuelva a interactuar.
export async function asegurarServiceWorker() {
  if (!soportaPush()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (error) {
    console.error('Error registrando el service worker:', error);
    return null;
  }
}

async function suscribirYGuardar(registro) {
  let suscripcion = await registro.pushManager.getSubscription();
  if (!suscripcion) {
    const { publicKey } = await apiRequest('/notificaciones/push/vapid-public-key');
    suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = suscripcion.toJSON();
  await apiRequest('/notificaciones/push/suscripcion', {
    method: 'POST',
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  return suscripcion;
}

export async function activarNotificacionesPush() {
  if (!soportaPush()) {
    return { ok: false, motivo: 'Este navegador no soporta notificaciones push.' };
  }

  try {
    const registro = await asegurarServiceWorker();
    if (!registro) return { ok: false, motivo: 'No se pudo registrar el service worker.' };

    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      return { ok: false, motivo: 'No se otorgó permiso de notificaciones.' };
    }

    await suscribirYGuardar(registro);
    return { ok: true };
  } catch (error) {
    console.error('Error activando notificaciones push:', error);
    return { ok: false, motivo: error.message };
  }
}

// Re-sincroniza la suscripción cada vez que arranca la app (si el permiso
// ya estaba concedido de antes), sin pedir nada al usuario. Esto es lo
// que realmente evita que las notificaciones dejen de llegar con el
// tiempo: los navegadores pueden rotar el endpoint de la suscripción por
// su cuenta, y si el backend se queda con el endpoint viejo, el envío
// falla en silencio hasta que alguien vuelve a tocar "Activar". Al
// reafirmar la suscripción actual en cada carga, cualquier cambio se
// refleja de inmediato sin depender de que el navegador soporte el
// evento 'pushsubscriptionchange' (Safari/iOS no lo soporta bien, por
// ejemplo).
export async function sincronizarSuscripcionPush() {
  if (!soportaPush()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const registro = await asegurarServiceWorker();
    if (!registro) return false;
    await registro.update().catch(() => {});
    await suscribirYGuardar(registro);
    return true;
  } catch (error) {
    console.warn('No se pudo sincronizar la suscripción push:', error.message);
    return false;
  }
}

export async function pushYaActivo() {
  if (!soportaPush()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const registro = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registro) return false;
    const suscripcion = await registro.pushManager.getSubscription();
    return Boolean(suscripcion);
  } catch {
    return false;
  }
}
