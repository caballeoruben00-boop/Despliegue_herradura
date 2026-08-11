/**
 * ============================================================
 *  Comercializadora de Granos La Herradura — API Layer
 *  api.evidencias.js  — Evidencias (fotos y archivos) de una tarea
 * ============================================================
 *
 * Endpoints del backend cubiertos:
 *   GET    /api/tareas/:id/evidencias               → listarEvidencias(tareaId)
 *   POST   /api/tareas/:id/evidencias                → subirEvidencias(tareaId, files)
 *   DELETE /api/tareas/:id/evidencias/:evidenciaId   → eliminarEvidencia(tareaId, evidenciaId)
 */

'use strict';

import { apiRequest } from './api.config.js';

/**
 * Lista las evidencias (fotos/archivos) de una tarea.
 * @param {number} tareaId
 * @returns {Promise<Evidencia[]>}
 */
export async function listarEvidencias(tareaId) {
  return apiRequest(`/tareas/${tareaId}/evidencias`);
}

/**
 * Sube una o varias evidencias a una tarea.
 * @param {number} tareaId
 * @param {FileList|File[]} archivos - hasta 5 archivos, 10MB c/u
 * @returns {Promise<Evidencia[]>}
 */
export async function subirEvidencias(tareaId, archivos) {
  const formData = new FormData();
  Array.from(archivos).forEach(file => formData.append('archivos', file));

  return apiRequest(`/tareas/${tareaId}/evidencias`, {
    method: 'POST',
    body: formData,
  });
}

/**
 * Elimina una evidencia de una tarea.
 * @param {number} tareaId
 * @param {number} evidenciaId
 * @returns {Promise<{ mensaje: string }>}
 */
export async function eliminarEvidencia(tareaId, evidenciaId) {
  return apiRequest(`/tareas/${tareaId}/evidencias/${evidenciaId}`, {
    method: 'DELETE',
  });
}
