/**
 * ============================================================
 *  Comercializadora de Granos La Herradura — API Layer
 *  api.auth.js  — Autenticación (login / sesión)
 * ============================================================
 *
 * Reemplaza el array USERS hardcodeado de login.js.
 * Llama a POST /api/auth/login y gestiona el token + sessionStorage.
 */

'use strict';

import { apiRequest } from './api.config.js';

/**
 * Inicia sesión contra el backend.
 *
 * @param {string} username  - Usuario o identificador
 * @param {string} password  - Contraseña
 * @returns {Promise<{ token: string, usuario: object }>}
 * @throws {Error} Si las credenciales son inválidas o hay error de red
 */
export async function login(username, password) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  // Guardar token y datos de usuario en sessionStorage
  sessionStorage.setItem('lh_token', data.token);
  sessionStorage.setItem('lh_user', JSON.stringify(data.usuario));

  return data;
}

/**
 * Cierra la sesión del usuario actual:
 * elimina token y datos de sessionStorage y redirige al login.
 */
export async function logout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // Si falla (sin conexión, token ya vencido, etc.) igual limpiamos
    // la sesión local — lo importante es que el usuario salga.
  }
  sessionStorage.removeItem('lh_token');
  sessionStorage.removeItem('lh_user');
  window.location.href = 'index.html';
}

/**
 * Devuelve el objeto de usuario guardado en sesión, o null si no hay sesión.
 * @returns {{ id, nombre, username, email, rol } | null}
 */
export function getUsuarioSesion() {
  const raw = sessionStorage.getItem('lh_user');
  return raw ? JSON.parse(raw) : null;
}

/**
 * Guard de ruta: si no hay sesión activa, redirige al login.
 * Llámalo al inicio de dashboard.js y cualquier página protegida.
 */
export function requireAuth() {
  if (!sessionStorage.getItem('lh_token')) {
    window.location.href = 'index.html';
  }
}
