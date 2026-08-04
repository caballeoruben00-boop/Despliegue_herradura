/**
 * ============================================================
 *  La Herradura — Ejemplo de uso de la API en dashboard.js
 * ============================================================
 *
 * Copia los fragmentos que necesites en tu dashboard.js existente.
 * Importa solo los módulos que uses en cada archivo.
 */

// ── Importar lo que necesitas ────────────────────────────────
import { requireAuth, getUsuarioSesion, logout } from './api.auth.js';
import { listarTareas, crearTarea, completarTarea } from './api.tareas.js';
import { listarUsuarios } from './api.usuarios.js';
import { listarAreas } from './api.areas.js';
import { generarReporte, descargarReportePDF } from './api.reportes.js';


// ── Guard: redirige al login si no hay sesión ────────────────
requireAuth();

const usuario = getUsuarioSesion();
console.log('Sesión activa:', usuario.nombre, '| Rol:', usuario.rol);


// ── Ejemplo: cargar tareas al iniciar ────────────────────────
async function cargarTareas() {
  try {
    const tareas = await listarTareas();                 // todas
    // const pendientes = await listarTareas({ estado: 'PENDIENTE' });
    renderizarTareas(tareas);
  } catch (err) {
    console.error('Error cargando tareas:', err.message);
    // Mostrar alerta en la UI...
  }
}

function renderizarTareas(tareas) {
  // Tu lógica de render aquí...
  console.log(`${tareas.length} tareas cargadas`);
}


// ── Ejemplo: crear tarea (solo admin) ────────────────────────
async function handleCrearTarea(formData) {
  try {
    const nueva = await crearTarea({
      nombre:      formData.get('nombre'),
      descripcion: formData.get('descripcion'),
      fechaInicio: formData.get('fechaInicio'),
      fechaFin:    formData.get('fechaFin'),
      hora:        formData.get('hora'),
      prioridad:   formData.get('prioridad'),          // 'ALTA' | 'MEDIA' | 'BAJA'
      areaId:      parseInt(formData.get('areaId')),
      asignadoAId: parseInt(formData.get('asignadoAId')),
    });
    console.log('Tarea creada:', nueva.id, nueva.nombre);
    cargarTareas();   // refrescar lista
  } catch (err) {
    console.error('No se pudo crear la tarea:', err.message);
  }
}


// ── Ejemplo: completar tarea ──────────────────────────────────
async function handleCompletarTarea(id) {
  try {
    await completarTarea(id);
    cargarTareas();
  } catch (err) {
    console.error('Error al completar tarea:', err.message);
  }
}


// ── Ejemplo: poblar <select> de áreas ────────────────────────
async function poblarSelectAreas(selectEl) {
  const areas = await listarAreas();
  areas.forEach(({ id, nombre }) => {
    const opt = document.createElement('option');
    opt.value       = id;
    opt.textContent = nombre;
    selectEl.appendChild(opt);
  });
}


// ── Ejemplo: generar y descargar reporte PDF ─────────────────
async function handleGenerarReporte() {
  try {
    const reporte = await generarReporte({ fechaInicio: '2025-01-01', fechaFin: '2025-12-31' });
    await descargarReportePDF(reporte.id);  // abre PDF en nueva pestaña
  } catch (err) {
    console.error('Error generando reporte:', err.message);
  }
}


// ── Cerrar sesión ────────────────────────────────────────────
document.getElementById('btn-logout')?.addEventListener('click', logout);


// ── Arranque ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', cargarTareas);
