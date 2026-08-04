/**
 * ============================================================
 *  La Herradura — API Layer
 *  api.areas.js  — Catálogo de áreas
 * ============================================================
 *
 * Endpoints cubiertos:
 *   GET  /api/areas   → listarAreas()   (cualquier usuario autenticado)
 *   POST /api/areas   → crearArea(datos) (solo ADMIN)
 */

'use strict';

import { apiRequest } from './api.config.js';

/**
 * Obtiene todas las áreas disponibles.
 * Útil para poblar los <select> al crear/editar tareas y usuarios.
 *
 * @returns {Promise<Area[]>}
 */
export async function listarAreas() {
  return apiRequest('/areas');
}

/**
 * Crea una nueva área en el sistema.
 * Solo accesible por ADMIN.
 *
 * @param {{ nombre: string, descripcion?: string }} datos
 * @returns {Promise<Area>}
 */
export async function crearArea(datos) {
  return apiRequest('/areas', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}
