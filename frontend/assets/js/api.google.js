/**
 * ============================================================
 *  Comercializadora de Granos La Herradura — API Layer
 *  api.google.js  — Vinculación con Google Calendar
 * ============================================================
 *
 * Endpoints cubiertos:
 *   GET  /api/google/conectar    → obtenerUrlConexionGoogle()
 *   GET  /api/google/estado      → obtenerEstadoGoogle()
 *   POST /api/google/desconectar → desconectarGoogle()
 */

'use strict';

import { apiRequest } from './api.config.js';

/**
 * Pide al backend la URL de consentimiento de Google a la que hay
 * que redirigir al usuario para conectar su cuenta.
 * @returns {Promise<{ url: string }>}
 */
export async function obtenerUrlConexionGoogle() {
  return apiRequest('/google/conectar');
}

/**
 * Consulta si el usuario actual ya tiene su Google Calendar
 * conectado (y con qué correo, si aplica).
 * @returns {Promise<{ conectado: boolean, email: string|null }>}
 */
export async function obtenerEstadoGoogle() {
  return apiRequest('/google/estado');
}

/**
 * Desvincula la cuenta de Google del usuario actual.
 * @returns {Promise<{ mensaje: string }>}
 */
export async function desconectarGoogle() {
  return apiRequest('/google/desconectar', { method: 'POST' });
}
