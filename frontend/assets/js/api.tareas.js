/**
 * ============================================================
 *  La Herradura — API Layer
 *  api.tareas.js  — CRUD de tareas
 * ============================================================
 *
 * Endpoints del backend cubiertos:
 *   GET    /api/tareas              → listarTareas()
 *   GET    /api/tareas?estado=X     → listarTareas({ estado })
 *   GET    /api/tareas/:id          → obtenerTarea(id)
 *   POST   /api/tareas              → crearTarea(datos)    [solo ADMIN]
 *   PUT    /api/tareas/:id          → actualizarTarea(id, datos) [solo ADMIN]
 *   PATCH  /api/tareas/:id/completar → completarTarea(id)
 *   DELETE /api/tareas/:id          → eliminarTarea(id)        [solo ADMIN]
 */

'use strict';

import { apiRequest } from './api.config.js';

/**
 * Obtiene la lista de tareas.
 * El backend filtra automáticamente según el rol del usuario en el token:
 *  - ADMIN → todas las tareas
 *  - Empleado → solo las asignadas a él
 *
 * @param {{ estado?: 'PENDIENTE'|'COMPLETADA'|'ATRASADA' }} [filtros]
 * @returns {Promise<Tarea[]>}
 */
export async function listarTareas(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.estado) params.set('estado', filtros.estado);

  const query = params.toString() ? `?${params}` : '';
  return apiRequest(`/tareas${query}`);
}

/**
 * Obtiene una tarea por su ID.
 * @param {number} id
 * @returns {Promise<Tarea>}
 */
export async function obtenerTarea(id) {
  return apiRequest(`/tareas/${id}`);
}

/**
 * Crea una nueva tarea. Solo ADMIN.
 *
 * @param {{
 *   nombre: string,
 *   descripcion?: string,
 *   fechaInicio: string,   // ISO 8601
 *   fechaFin: string,      // ISO 8601
 *   hora?: string,
 *   prioridad: 'ALTA'|'MEDIA'|'BAJA',
 *   asignadoAId: number
 * }} datos
 * @returns {Promise<Tarea>}
 */
export async function crearTarea(datos) {
  return apiRequest('/tareas', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

/**
 * Actualiza los campos de una tarea. Solo ADMIN.
 * Solo manda los campos que quieres modificar.
 *
 * @param {number} id
 * @param {Partial<DatosTarea>} datos
 * @returns {Promise<Tarea>}
 */
export async function actualizarTarea(id, datos) {
  return apiRequest(`/tareas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
}

/**
 * Marca una tarea como COMPLETADA.
 * Disponible para cualquier usuario autenticado.
 *
 * @param {number} id
 * @returns {Promise<Tarea>}
 */
export async function completarTarea(id) {
  return apiRequest(`/tareas/${id}/completar`, {
    method: 'PATCH',
  });
}

/**
 * Elimina definitivamente una tarea. Solo ADMIN.
 *
 * @param {number} id
 * @returns {Promise<{ mensaje: string }>}
 */
export async function eliminarTarea(id) {
  return apiRequest(`/tareas/${id}`, {
    method: 'DELETE',
  });
}
