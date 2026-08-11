/**
 * ============================================================
 *  Comercializadora de Granos La Herradura — API Layer
 *  api.config.js  — Configuración base y cliente HTTP
 * ============================================================
 *
 * Este archivo es el único lugar donde se define la URL del
 * backend. Si cambias de puerto o pasas a producción, solo
 * modificas BASE_URL aquí.
 */

'use strict';

// ── Configuración global ─────────────────────────────────────
export const BASE_URL = '/api';

// URL raíz del servidor (sin /api), para construir rutas de archivos
// estáticos como las evidencias subidas (/uploads/evidencias/...).
export const SERVER_URL = BASE_URL.replace(/\/api\/?$/, '');

/**
 * Cliente HTTP centralizado.
 * Todas las peticiones al backend pasan por aquí:
 *  - Adjunta el token JWT automáticamente si existe en sessionStorage.
 *  - Lanza un Error con el mensaje del servidor cuando el status >= 400.
 *  - Devuelve el JSON ya parseado.
 *
 * @param {string} endpoint  - Ruta relativa, ej. '/tareas' o '/auth/login'
 * @param {RequestInit} opts - Opciones fetch opcionales (method, body, etc.)
 * @returns {Promise<any>}   - JSON de respuesta
 */
export async function apiRequest(endpoint, opts = {}) {
  const token = sessionStorage.getItem('lh_token');

  // Si el body es FormData (subida de archivos), NO fijamos Content-Type:
  // el navegador debe generar el boundary del multipart automáticamente.
  const esFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;

  const headers = {
    ...(esFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers ?? {}),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...opts,
    headers,
  });

  // Intentar parsear el cuerpo siempre (error o éxito)
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    // Usa el mensaje que mande el servidor, o uno genérico
    const msg = data?.error ?? `Error ${response.status}: ${response.statusText}`;
    throw new Error(msg);
  }

  return data;
}
