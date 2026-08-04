/**
 * ============================================================
 *  La Herradura — API Layer
 *  api.usuarios.js  — Gestión de usuarios (solo ADMIN)
 * ============================================================
 *
 * Endpoints cubiertos:
 *   GET   /api/usuarios              → listarUsuarios()
 *   POST  /api/usuarios              → crearUsuario(datos)
 *   PUT   /api/usuarios/:id          → actualizarUsuario(id, datos)
 *   PATCH /api/usuarios/me/password  → cambiarMiPassword(datos)
 */

'use strict';

import { apiRequest } from './api.config.js';

/**
 * Obtiene la lista de todos los usuarios del sistema.
 * Solo accesible por ADMIN.
 *
 * @returns {Promise<Usuario[]>}
 */
export async function listarUsuarios() {
  return apiRequest('/usuarios');
}

/**
 * Crea un nuevo usuario en el sistema.
 * Solo accesible por ADMIN.
 *
 * @param {{
 *   nombre: string,
 *   username: string,
 *   email: string,
 *   password: string,
 *   rol: 'ADMIN'|'EMPLEADO'
 * }} datos
 * @returns {Promise<Usuario>}
 */
export async function crearUsuario(datos) {
  return apiRequest('/usuarios', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

/**
 * Actualiza los datos de un usuario.
 * Solo accesible por ADMIN.
 *
 * @param {number} id
 * @param {Partial<DatosUsuario>} datos - Solo los campos a modificar
 * @returns {Promise<Usuario>}
 */
export async function actualizarUsuario(id, datos) {
  return apiRequest(`/usuarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
}

/**
 * Cambia la contraseña del usuario actualmente autenticado.
 * Requiere confirmar la contraseña actual.
 *
 * @param {string} passwordActual
 * @param {string} passwordNueva
 * @returns {Promise<{ mensaje: string }>}
 */
export async function cambiarMiPassword(passwordActual, passwordNueva) {
  return apiRequest('/usuarios/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ passwordActual, passwordNueva }),
  });
}

/**
 * Desactiva (soft delete) a un usuario. Requiere contraseña de
 * confirmación: la de quien ejecuta la acción, salvo que el usuario
 * objetivo sea ADMIN, en cuyo caso el backend exige la contraseña de
 * ESE administrador.
 *
 * @param {number} id
 * @param {string} password
 * @returns {Promise<Usuario>}
 */
export async function desactivarUsuario(id, password) {
  return apiRequest(`/usuarios/${id}/desactivar`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  });
}

/**
 * Elimina (hard delete) definitivamente a un usuario. Misma regla de
 * confirmación de contraseña que desactivarUsuario.
 *
 * @param {number} id
 * @param {string} password
 * @returns {Promise<{ mensaje: string }>}
 */
export async function eliminarUsuario(id, password) {
  return apiRequest(`/usuarios/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
}
