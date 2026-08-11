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

export async function activarNotificacionesPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, motivo: 'Este navegador no soporta notificaciones push.' };
  }

  try {
    const registro = await navigator.serviceWorker.register('/sw.js');

    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      return { ok: false, motivo: 'No se otorgó permiso de notificaciones.' };
    }

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

    return { ok: true };
  } catch (error) {
    console.error('Error activando notificaciones push:', error);
    return { ok: false, motivo: error.message };
  }
}

export async function pushYaActivo() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
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
