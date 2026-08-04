/**
 * ============================================================
 *  La Herradura — API Layer
 *  api.notificaciones.js — Notificaciones en tiempo real + historial
 * ============================================================
 *
 * Endpoints del backend cubiertos:
 *   GET    /api/notificaciones               → listarNotificaciones()
 *   GET    /api/notificaciones/no-leidas      → contarNoLeidas()
 *   PATCH  /api/notificaciones/:id/leer       → marcarLeida(id)
 *   PATCH  /api/notificaciones/leer-todas     → marcarTodasLeidas()
 *   DELETE /api/notificaciones/:id            → eliminarNotificacion(id)
 *   GET    /api/notificaciones/stream (SSE)   → abrirStreamNotificaciones(onMensaje)
 */

'use strict';

import { apiRequest, BASE_URL } from './api.config.js';

/**
 * Obtiene el historial de notificaciones del usuario autenticado.
 *
 * @param {{ soloNoLeidas?: boolean, limit?: number, antesDeId?: number }} [opts]
 * @returns {Promise<{ notificaciones: object[], noLeidas: number }>}
 */
export async function listarNotificaciones(opts = {}) {
  const params = new URLSearchParams();
  if (opts.soloNoLeidas) params.set('soloNoLeidas', 'true');
  if (opts.limit)        params.set('limit', opts.limit);
  if (opts.antesDeId)    params.set('antesDeId', opts.antesDeId);
  const query = params.toString() ? `?${params}` : '';
  return apiRequest(`/notificaciones${query}`);
}

/** @returns {Promise<{ noLeidas: number }>} */
export async function contarNoLeidas() {
  return apiRequest('/notificaciones/no-leidas');
}

/** @param {number} id @returns {Promise<object>} */
export async function marcarLeida(id) {
  return apiRequest(`/notificaciones/${id}/leer`, { method: 'PATCH' });
}

/** @returns {Promise<{ actualizadas: number }>} */
export async function marcarTodasLeidas() {
  return apiRequest('/notificaciones/leer-todas', { method: 'PATCH' });
}

/** @param {number} id @returns {Promise<{ mensaje: string }>} */
export async function eliminarNotificacion(id) {
  return apiRequest(`/notificaciones/${id}`, { method: 'DELETE' });
}

/**
 * Abre la conexión Server-Sent Events con el backend para recibir
 * notificaciones en tiempo real. El token viaja como query param
 * porque EventSource no permite mandar headers personalizados.
 *
 * Se reconecta automáticamente (comportamiento nativo de EventSource)
 * si la conexión se cae; devuelve la instancia para poder cerrarla
 * manualmente con .close() si hace falta (p. ej. al hacer logout).
 *
 * @param {(notificacion: object) => void} onNotificacion
 * @returns {EventSource}
 */
export function abrirStreamNotificaciones(onNotificacion) {
  const token = sessionStorage.getItem('lh_token');
  const es = new EventSource(`${BASE_URL}/notificaciones/stream?token=${encodeURIComponent(token || '')}`);

  es.addEventListener('notificacion', e => {
    try {
      onNotificacion(JSON.parse(e.data));
    } catch (err) {
      console.error('Notificación SSE malformada:', err);
    }
  });

  es.onerror = () => {
    // EventSource reintenta solo; no hacemos nada especial aquí, solo
    // evitamos que un error sin manejar rompa la consola con ruido.
  };

  return es;
}
