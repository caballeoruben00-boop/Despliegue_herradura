/**
 * ============================================================
 *  La Herradura — API Layer
 *  api.reportes.js  — Generación y consulta de reportes (solo ADMIN)
 * ============================================================
 *
 * Endpoints cubiertos:
 *   GET  /api/reportes        → listarReportes()
 *   GET  /api/reportes/:id    → obtenerReporte(id)
 *   GET  /api/reportes/:id/pdf → descargarReportePDF(id)
 *   POST /api/reportes        → generarReporte(datos)
 */

'use strict';

import { apiRequest, BASE_URL } from './api.config.js';

/**
 * Lista todos los reportes generados.
 * Solo ADMIN.
 *
 * @returns {Promise<Reporte[]>}
 */
export async function listarReportes() {
  return apiRequest('/reportes');
}

/**
 * Obtiene el detalle de un reporte por ID.
 * Solo ADMIN.
 *
 * @param {number} id
 * @returns {Promise<Reporte>}
 */
export async function obtenerReporte(id) {
  return apiRequest(`/reportes/${id}`);
}

/**
 * Genera un nuevo reporte. El backend crea el PDF con Puppeteer.
 * Solo ADMIN.
 *
 * @param {{
 *   fechaInicio?: string,
 *   fechaFin?: string,
 *   empleadoId?: number
 * }} [filtros]
 * @returns {Promise<Reporte>}
 */
export async function generarReporte(filtros = {}) {
  return apiRequest('/reportes', {
    method: 'POST',
    body: JSON.stringify(filtros),
  });
}

/**
 * Descarga el PDF de un reporte abriéndolo en una nueva pestaña.
 * Usa fetch con el token para un endpoint protegido que devuelve binario.
 *
 * @param {number} id
 */
export async function descargarReportePDF(id) {
  const token = sessionStorage.getItem('lh_token');

  const response = await fetch(`${BASE_URL}/reportes/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Error al obtener el PDF: ${response.status}`);
  }

  // Crear un Blob con el PDF y abrirlo en nueva pestaña
  const blob = await response.blob();
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');

  // Limpiar la URL temporal después de un momento
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
