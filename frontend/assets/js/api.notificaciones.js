/**
 * ============================================================
 *  Comercializadora de Granos La Herradura — API Layer
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
 * IMPORTANTE — por qué esto NO puede ser un simple `new EventSource(...)`:
 * EventSource solo reconecta solo cuando la conexión se cae por una falla
 * de RED (WiFi intermitente, el server se reinicia a media conexión, etc).
 * Pero cuando el servidor responde con un status HTTP distinto de 200
 * (por ejemplo 401 porque el token de 8h ya expiró, o un 502 durante un
 * despliegue), el spec de EventSource considera la conexión "fallida
 * permanentemente": la cierra (readyState = CLOSED) y JAMÁS vuelve a
 * intentar por sí solo. Si alguien deja el dashboard abierto toda la
 * jornada, en cuanto el token expira las notificaciones en tiempo real
 * se detienen en silencio para siempre, sin ningún error visible, hasta
 * que la persona recarga la página manualmente.
 *
 * Esta función implementa reconexión manual con backoff exponencial
 * cada vez que detecta readyState === CLOSED, y notifica los cambios de
 * estado de la conexión (para poder mostrar, si se quiere, un aviso de
 * "reconectando…"). Además se reconecta de inmediato cuando la pestaña
 * vuelve a estar visible o cuando el navegador recupera la conexión a
 * internet, en vez de esperar al backoff.
 *
 * @param {(notificacion: object) => void} onNotificacion
 * @param {(estado: 'conectado'|'reconectando'|'perdido') => void} [onEstadoCambio]
 * @returns {{ cerrar: () => void, reconectarAhora: () => void }}
 */
export function abrirStreamNotificaciones(onNotificacion, onEstadoCambio = () => {}) {
  const MAX_DELAY_MS = 30_000;
  const BASE_DELAY_MS = 3_000;
  const MAX_INTENTOS_ANTES_DE_AVISAR = 4; // ~ tras esto avisamos "conexión perdida"

  let es = null;
  let intentos = 0;
  let timeoutReconexion = null;
  let cerradoManualmente = false;

  function limpiarTimeout() {
    if (timeoutReconexion) {
      clearTimeout(timeoutReconexion);
      timeoutReconexion = null;
    }
  }

  function programarReconexion() {
    limpiarTimeout();
    intentos++;
    if (intentos >= MAX_INTENTOS_ANTES_DE_AVISAR) onEstadoCambio('perdido');
    else onEstadoCambio('reconectando');

    const delay = Math.min(BASE_DELAY_MS * 2 ** (intentos - 1), MAX_DELAY_MS);
    timeoutReconexion = setTimeout(conectar, delay);
  }

  function conectar() {
    if (cerradoManualmente) return;
    limpiarTimeout();

    const token = sessionStorage.getItem('lh_token');
    if (!token) return; // sin sesión no tiene caso intentar

    if (es) { try { es.close(); } catch { /* ya cerrado */ } }

    es = new EventSource(`${BASE_URL}/notificaciones/stream?token=${encodeURIComponent(token)}`);

    es.addEventListener('notificacion', e => {
      try {
        onNotificacion(JSON.parse(e.data));
      } catch (err) {
        console.error('Notificación SSE malformada:', err);
      }
    });

    es.onopen = () => {
      intentos = 0;
      onEstadoCambio('conectado');
    };

    es.onerror = () => {
      // readyState === CONNECTING: fue una falla de red pasajera; el
      // propio navegador ya está reintentando la conexión, no hacemos
      // nada más que reflejar el estado.
      if (es.readyState === EventSource.CONNECTING) {
        onEstadoCambio('reconectando');
        return;
      }
      // readyState === CLOSED: el navegador NO va a reintentar (típico
      // de un 401 por token expirado, o un error HTTP del servidor).
      // Tomamos el control y reconectamos nosotros mismos.
      if (es.readyState === EventSource.CLOSED) {
        programarReconexion();
      }
    };
  }

  conectar();

  // Reconectar de inmediato al volver a la pestaña o al recuperar
  // internet, en vez de esperar el backoff — así no se acumula
  // atraso si la laptop estuvo dormida o el WiFi se fue un rato.
  const alVolverVisible = () => {
    if (document.visibilityState === 'visible' && (!es || es.readyState === EventSource.CLOSED)) {
      intentos = 0;
      conectar();
    }
  };
  document.addEventListener('visibilitychange', alVolverVisible);
  window.addEventListener('online', alVolverVisible);

  return {
    cerrar() {
      cerradoManualmente = true;
      limpiarTimeout();
      document.removeEventListener('visibilitychange', alVolverVisible);
      window.removeEventListener('online', alVolverVisible);
      if (es) { try { es.close(); } catch { /* ya cerrado */ } }
    },
    reconectarAhora() {
      intentos = 0;
      conectar();
    },
  };
}
