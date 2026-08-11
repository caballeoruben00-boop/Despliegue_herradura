/**
 * La Herradura — Dashboard Core
 * Sesión, estado compartido (store) y utilidades usadas por el resto
 * de los módulos del dashboard (tasks, users, reports).
 */
'use strict';

import { requireAuth, getUsuarioSesion, logout } from './api.auth.js';

/* ══════════════════════════════════════════════════════════════
   SESIÓN
══════════════════════════════════════════════════════════════ */
requireAuth();
export const session = getUsuarioSesion();
if (!session) throw new Error('Sin sesión');
export const isAdmin    = session.rol === 'ADMIN';
export const isEmpleado = session.rol === 'EMPLEADO';
// Solo ADMIN administra usuarios y asigna tareas.
export const canManageUsers = isAdmin;

export { logout };

/* ══════════════════════════════════════════════════════════════
   STORE — Estado en memoria (datos vienen del backend)
══════════════════════════════════════════════════════════════ */
export const store = {
  tasks:    [],
  users:    [],
  activeTaskFilter:  'all',
  activeTaskSearch:  '',
  activeTimeFilter:  'all',
  activeSection:     'overview',
  advancedFiltersOpen: false,
  editingTaskId:  null,
  editingUserId:  null,
  evidenciasTaskId:   null,
  evidenciasActuales: [],
  confirmCallback: null,
  confirmRequiresPassword: false,
  reportHistory:  [],
  rptChartDona:   null,
  rptChartBarras: null,

  notifications:     [],
  unreadNotifCount:  0,
  notifDropdownOpen: false,
  notifHistoryFilter: 'all',
  notifOldestId:     null,
  notifHasMore:      true,
};

/* ══════════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════════ */
export const $  = id  => document.getElementById(id);
export const $$ = sel => document.querySelectorAll(sel);

export function escHtml(str = '') {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  // Las fechas de tareas (fechaInicio/fechaFin) se guardan como fecha "pura"
  // (medianoche UTC), sin hora real asociada. Por eso se leen con los
  // getters UTC (getUTCDate, etc.) y no con los locales: si se usaran los
  // locales, en zonas horarias detrás de UTC (como México) la fecha se
  // corre un día hacia atrás.
  const d = new Date(dateStr);
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function getTaskStatus(task) {
  const estado = task.estado || task.status || '';
  if (estado === 'COMPLETADA' || estado === 'done') return 'done';
  if (estado === 'ATRASADA'   || estado === 'overdue') return 'overdue';
  return 'pending';
}

export function isOverdue(task) {
  return getTaskStatus(task) === 'overdue';
}

export function labelStatus(st) {
  return { pending: 'Pendiente', done: 'Completada', overdue: 'Atrasada' }[st] || st;
}

export function labelPriority(p) {
  const map = { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja', high: 'Alta', medium: 'Media', low: 'Baja' };
  return map[p] || p;
}

/**
 * Normaliza la prioridad del backend ('ALTA'|'MEDIA'|'BAJA') a la clave que
 * usa el CSS ('high'|'medium'|'low'), tanto para la etiqueta de color como
 * para la franja lateral de la tarjeta.
 */
export function priorityKey(p = '') {
  return { alta: 'high', media: 'medium', baja: 'low',
           high: 'high', medium: 'medium', low: 'low' }[String(p).toLowerCase()] || '';
}

export function getInitials(name = '') {
  return name.split(' ').slice(0,2).map(n => n[0] || '').join('').toUpperCase();
}

export function showModal(id) {
  const el = $(id); if (!el) return;
  el.removeAttribute('hidden'); el.style.display = '';
}
export function hideModal(id) {
  const el = $(id); if (!el) return;
  el.hidden = true; el.style.display = 'none';
}

export function toast(msg, type = 'default') {
  const c = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 300ms ease forwards';
    el.addEventListener('animationend', () => el.remove());
  }, 3200);
}

/* ══════════════════════════════════════════════════════════════
   PANTALLA DE CARGA GLOBAL (bloquea la UI, evita doble-click)
══════════════════════════════════════════════════════════════ */
let loadingDepth = 0;

export function showLoading(msg = 'Generando PDF…') {
  loadingDepth++;
  const el = $('global-loading-overlay');
  if (!el) return;
  const textEl = el.querySelector('.global-loading__text');
  if (textEl) textEl.textContent = msg;
  el.removeAttribute('hidden');
  requestAnimationFrame(() => el.classList.add('is-visible'));
}

export function hideLoading() {
  loadingDepth = Math.max(0, loadingDepth - 1);
  if (loadingDepth > 0) return;
  const el = $('global-loading-overlay');
  if (!el) return;
  el.classList.remove('is-visible');
  setTimeout(() => { if (loadingDepth === 0) el.setAttribute('hidden', ''); }, 200);
}

export function animateCount(el, target) {
  if (!el) return;
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 20));
  const t = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(t);
  }, 40);
}

/* ══════════════════════════════════════════════════════════════
   VALIDACIÓN MODAL
══════════════════════════════════════════════════════════════ */
export function showModalError(errId, inputEl, msg) {
  const e = $(errId); if (e) e.textContent = msg;
  if (inputEl) inputEl.classList.add('is-invalid');
}
export function clearModalError(errId, inputEl) {
  const e = $(errId); if (e) e.textContent = '';
  if (inputEl) inputEl.classList.remove('is-invalid');
}
export function clearModalErrors(ids) {
  ids.forEach(id => { const el=$(id); if(el) el.textContent=''; });
  $$('.mform-input.is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

/* ══════════════════════════════════════════════════════════════
   MODAL CONFIRMACIÓN — compartido por tasks.js y users.js
══════════════════════════════════════════════════════════════ */
export function openConfirm(message, callback, opts = {}) {
  const { title = '¿Confirmar acción?', okLabel = 'Sí, confirmar', okClass = 'btn-danger', showClose = true, requirePassword = false } = opts;
  $('modal-confirm-title').textContent = title;
  $('confirm-message').textContent = message;
  $('modal-confirm-ok').textContent = okLabel;
  $('modal-confirm-ok').className = okClass;
  $('modal-confirm-close').style.display = showClose ? '' : 'none';
  store.confirmCallback = callback;
  store.confirmRequiresPassword = requirePassword;
  const pwGroup = $('confirm-password-group');
  const pwInput = $('confirm-password');
  if (pwGroup) pwGroup.hidden = !requirePassword;
  if (pwInput) pwInput.value = '';
  clearModalError('err-confirm-password', pwInput);
  showModal('modal-confirm-backdrop');
  if (requirePassword) setTimeout(() => pwInput?.focus(), 50);
}

export function closeConfirm() {
  hideModal('modal-confirm-backdrop');
  store.confirmCallback = null;
  store.confirmRequiresPassword = false;
  const pwInput = $('confirm-password');
  if (pwInput) pwInput.value = '';
}

/* ══════════════════════════════════════════════════════════════
   EVENTOS — modal de confirmación (usado por Escape y por el
   botón OK, cuyo callback puede venir de tasks.js o users.js)
══════════════════════════════════════════════════════════════ */
export function attachConfirmModalEvents() {
  $('modal-confirm-close')?.addEventListener('click', closeConfirm);
  $('modal-confirm-cancel')?.addEventListener('click', closeConfirm);
  $('modal-confirm-backdrop')?.addEventListener('click', e => { if(e.target===$('modal-confirm-backdrop')) closeConfirm(); });
  $('modal-confirm-ok')?.addEventListener('click', () => {
    if (store.confirmRequiresPassword) {
      const pwInput = $('confirm-password');
      const pwd = pwInput?.value || '';
      if (!pwd) { showModalError('err-confirm-password', pwInput, 'Ingresa tu contraseña.'); return; }
      if (store.confirmCallback) store.confirmCallback(pwd);
    } else {
      if (store.confirmCallback) store.confirmCallback();
    }
    closeConfirm();
  });
}
