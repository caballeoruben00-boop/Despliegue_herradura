/**
 * Comercializadora de Granos La Herradura — Dashboard v4.0
 * Conectado al backend real (Express + Prisma + PostgreSQL)
 *
 * Este archivo es el punto de entrada / orquestador. La lógica se
 * separó en módulos más pequeños:
 *   - dashboard.core.js    → sesión, store y utilidades compartidas
 *   - dashboard.tasks.js   → lista de tareas, filtros y modal de tarea
 *   - dashboard.users.js   → directorio de empleados y modal de usuario
 *   - dashboard.reports.js → reportes, gráficas e historial
 */
'use strict';

import {
  $, $$, store, session, logout, toast, animateCount, getInitials, getTaskStatus,
  canManageUsers, isAdmin, openConfirm, attachConfirmModalEvents,
} from './dashboard.core.js';
import { listarTareas } from './api.tareas.js';
import { listarUsuarios } from './api.usuarios.js';
import {
  renderTaskPreview, renderTaskList,
  attachTaskEvents, patchTaskModal,
} from './dashboard.tasks.js';
import { renderEmployees, populateEmployeeFilters, attachUserEvents } from './dashboard.users.js';
import { populateReportEmpleadoSelect, attachReportEvents } from './dashboard.reports.js';
import { initNotifications, attachNotifEvents } from './dashboard.notifications.js';
import { attachProfileEvents } from './dashboard.profile.js';

/* ══════════════════════════════════════════════════════════════
   CARGA INICIAL DE DATOS
══════════════════════════════════════════════════════════════ */
async function loadAll() {
  // Un EMPLEADO no tiene permiso para listar el directorio completo
  // de usuarios; solo necesita verse a sí mismo (para el selector de
  // "asignar a" y el filtro de reportes, que siempre quedan fijos en él).
  const peticionUsuarios = canManageUsers ? listarUsuarios() : Promise.resolve([session]);

  const [tareasR, usuariosR] = await Promise.allSettled([
    listarTareas(),
    peticionUsuarios,
  ]);

  if (tareasR.status === 'fulfilled') store.tasks = tareasR.value;
  else toast('❌ Error cargando tareas: ' + tareasR.reason.message, 'error');

  if (usuariosR.status === 'fulfilled') store.users = usuariosR.value;
  else toast('❌ Error cargando empleados: ' + usuariosR.reason.message, 'error');
}

/* ══════════════════════════════════════════════════════════════
   REFRESCO EN TIEMPO REAL — se llama cuando llega por SSE una
   notificación relacionada con tareas (asignación, reasignación,
   cambio de estado, eliminación, etc.), para que la lista de tareas
   se actualice sola sin que el usuario tenga que recargar la página.
══════════════════════════════════════════════════════════════ */
export async function refreshTasks() {
  try {
    store.tasks = await listarTareas();
    renderAll();
  } catch (e) {
    console.error('Error refrescando tareas en tiempo real:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   RENDER PRINCIPAL — orquesta el render de cada módulo
══════════════════════════════════════════════════════════════ */
export function renderAll() {
  renderKPIs();
  renderTaskPreview();
  renderTaskList();
  renderEmployees();
  updateTasksBadge();
}

function renderKPIs() {
  const total   = store.tasks.length;
  const done    = store.tasks.filter(t => getTaskStatus(t) === 'done').length;
  const pending = store.tasks.filter(t => getTaskStatus(t) === 'pending').length;
  const overdue = store.tasks.filter(t => getTaskStatus(t) === 'overdue').length;
  animateCount($('kpi-total'),   total);
  animateCount($('kpi-pending'), pending);
  animateCount($('kpi-done'),    done);
  animateCount($('kpi-overdue'), overdue);
}

function updateTasksBadge() {
  const pending = store.tasks.filter(t => getTaskStatus(t) !== 'done').length;
  const badge = $('tasks-badge');
  if (badge) badge.textContent = pending;
}

/* ══════════════════════════════════════════════════════════════
   NAVEGACIÓN
══════════════════════════════════════════════════════════════ */
window.navigateTo = function(sectionId) {
  if (sectionId === 'employees' && !canManageUsers) return; // solo ADMIN
  if (sectionId === 'reports' && !isAdmin) return; // solo ADMIN// solo ADMIN
  $$('.content-section').forEach(s => s.classList.add('content-section--hidden'));
  $(`section-${sectionId}`)?.classList.remove('content-section--hidden');
  $$('.sidebar__nav-link').forEach(a => a.classList.remove('sidebar__nav-link--active'));
  document.querySelector(`.sidebar__nav-link[data-section="${sectionId}"]`)?.classList.add('sidebar__nav-link--active');
  const titles = { overview: 'Panel General', tasks: 'Tareas', employees: 'Usuarios', reports: 'Reportes', notifications: 'Notificaciones' };
  const titleEl = $('page-title');
  if (titleEl) titleEl.textContent = titles[sectionId] || sectionId;
  store.activeSection = sectionId;
  closeMobileSidebar();
};

/* ══════════════════════════════════════════════════════════════
   SIDEBAR MOBILE
══════════════════════════════════════════════════════════════ */
function openMobileSidebar() {
  $('sidebar').classList.add('is-open');
  $('sidebar-overlay').classList.add('is-visible');
  // Evita que el contenido siga desplazándose detrás del menú en móvil
  document.body.classList.add('has-drawer-open');
  $('btn-hamburger')?.setAttribute('aria-expanded', 'true');
}
function closeMobileSidebar() {
  $('sidebar').classList.remove('is-open');
  $('sidebar-overlay').classList.remove('is-visible');
  document.body.classList.remove('has-drawer-open');
  $('btn-hamburger')?.setAttribute('aria-expanded', 'false');
}

/* ══════════════════════════════════════════════════════════════
   RELOJ
══════════════════════════════════════════════════════════════ */
function startClock() {
  function tick() {
    const now = new Date();
    const el = $('topbar-datetime');
    if (el) el.innerHTML = `${now.toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}<br/>${now.toLocaleTimeString('es-MX')}`;
  }
  tick(); setInterval(tick, 1000);
}

/* ══════════════════════════════════════════════════════════════
   SESIÓN EN UI
══════════════════════════════════════════════════════════════ */
function populateSession() {
  const initials = getInitials(session.nombre);
  const rolLabel = isAdmin ? 'Administrador' : 'Empleado';
  const campos = {
    'sidebar-avatar': initials, 'sidebar-name': session.nombre,
    'sidebar-role': rolLabel,
    'topbar-avatar': initials,  'topbar-name': session.nombre,
    'topbar-role': rolLabel,
  };
  Object.entries(campos).forEach(([id, val]) => { const el=$(id); if(el) el.textContent=val; });
}

function applyRolePermissions() {
  // El botón/sección "Empleados" solo es visible para ADMIN.
  const navEmployees = $('nav-employees-item');
  if (navEmployees) navEmployees.style.display = canManageUsers ? '' : 'none';

  // El botón/sección "Reportes" solo es visible para ADMIN.
  const navReports = $('nav-reports-item');
  if (navReports) navReports.style.display = isAdmin ? '' : 'none';

  if (canManageUsers) {
    const adminNav = $('admin-nav');
    if (adminNav) adminNav.style.display = '';
    const btnNewUser = $('btn-new-user');
    if (btnNewUser) btnNewUser.style.display = '';
  }
}

/* ══════════════════════════════════════════════════════════════
   EVENTOS GLOBALES (logout, hamburguesa, navegación)
══════════════════════════════════════════════════════════════ */
function attachGlobalEvents() {
  // Logout
  $('btn-logout')?.addEventListener('click', () => {
    openConfirm('¿Deseas cerrar sesión?', () => { logout(); },
      { title:'Cerrar Sesión', okLabel:'Cerrar Sesión', okClass:'btn-primary', showClose:false });
  });

  // Hamburger
  $('btn-hamburger')?.addEventListener('click', () => {
    $('sidebar').classList.contains('is-open') ? closeMobileSidebar() : openMobileSidebar();
  });
  $('sidebar-overlay')?.addEventListener('click', closeMobileSidebar);

  // Nav links
  $$('.sidebar__nav-link').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); const s=link.dataset.section; if(s) window.navigateTo(s); });
  });

  $('btn-go-tasks')?.addEventListener('click', () => window.navigateTo('tasks'));

  attachConfirmModalEvents();
}

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  populateSession();
  applyRolePermissions();
  patchTaskModal();
  startClock();
  attachGlobalEvents();
  attachTaskEvents();
  attachUserEvents();
  attachReportEvents();
  attachNotifEvents();
  attachProfileEvents();

  // Fijar año en reportes
  const anioSel = $('rpt-filter-anio');
  if (anioSel) {
    const y = new Date().getFullYear().toString();
    let found = false;
    for (let i = 0; i < anioSel.options.length; i++) {
      if (anioSel.options[i].value === y) { anioSel.selectedIndex=i; found=true; break; }
    }
    if (!found) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y; opt.selected = true;
      anioSel.insertBefore(opt, anioSel.options[1] || null);
    }
  }

  await loadAll();
  populateEmployeeFilters();
  renderAll();
  populateReportEmpleadoSelect();
  initNotifications();
});
