/**
 * La Herradura — Dashboard: Notificaciones
 * Campana con dropdown en tiempo real, historial completo con
 * filtro de no leídas y paginación, y conexión SSE al backend.
 */
'use strict';

import { $, $$, escHtml, store, toast } from './dashboard.core.js';
import {
  listarNotificaciones, marcarLeida, marcarTodasLeidas,
  eliminarNotificacion, abrirStreamNotificaciones,
} from './api.notificaciones.js';
import { refreshTasks } from './dashboard.js';

const PAGE_SIZE = 30;
const DROPDOWN_MAX = 8;

let eventSource = null;

/* ══════════════════════════════════════════════════════════════
   UTILIDADES DE PRESENTACIÓN
══════════════════════════════════════════════════════════════ */
const ICONOS = {
  TAREA_ASIGNADA:        '📌',
  TAREA_ACTUALIZADA:     '✏️',
  TAREA_PROXIMA_VENCER:  '⏰',
  TAREA_VENCIDA:         '🚨',
  TAREA_COMPLETADA:      '✅',
  TAREA_ELIMINADA:       '🗑️',
  GENERAL:               '🔔',
};

function tiempoRelativo(fechaStr) {
  const ahora = new Date();
  const fecha = new Date(fechaStr);
  const segs = Math.floor((ahora - fecha) / 1000);
  if (segs < 60)   return 'justo ahora';
  const mins = Math.floor(segs / 60);
  if (mins < 60)   return `hace ${mins} min`;
  const horas = Math.floor(mins / 60);
  if (horas < 24)  return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7)    return `hace ${dias} d`;
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function buildNotifItem(n) {
  const tipoClass = (n.tipo || 'general').toLowerCase();
  const icono = ICONOS[n.tipo] || ICONOS.GENERAL;
  return `<div class="notif-item notif-item--${tipoClass}${n.leida ? '' : ' notif-item--unread'}" data-id="${n.id}" data-tarea-id="${n.tareaId ?? n.tarea?.id ?? ''}">
    <div class="notif-item__icon">${icono}</div>
    <div class="notif-item__body">
      <span class="notif-item__title">${escHtml(n.titulo)}</span>
      <span class="notif-item__msg">${escHtml(n.mensaje)}</span>
      <span class="notif-item__time">${tiempoRelativo(n.creadoEn)}</span>
    </div>
    ${!n.leida ? '<div class="notif-item__dot" title="No leída"></div>' : ''}
    <button class="notif-item__del" data-del-id="${n.id}" title="Eliminar" aria-label="Eliminar notificación">✕</button>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════════════════ */
function renderBell() {
  const badge = $('notif-bell-badge');
  const navBadge = $('notif-nav-badge');
  const count = store.unreadNotifCount;
  if (badge) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
  }
  if (navBadge) {
    navBadge.textContent = count > 99 ? '99+' : String(count);
    navBadge.style.display = count === 0 ? 'none' : '';
  }
}

function renderDropdown() {
  const list = $('notif-dropdown-list');
  if (!list) return;
  const recientes = store.notifications.slice(0, DROPDOWN_MAX);
  if (!recientes.length) {
    list.innerHTML = `<div class="empty-state" style="padding:var(--space-6);"><p>No hay notificaciones todavía.</p></div>`;
    return;
  }
  list.innerHTML = recientes.map(buildNotifItem).join('');
}

function renderHistory() {
  const list = $('notif-history-list');
  if (!list) return;
  const items = store.notifHistoryFilter === 'unread'
    ? store.notifications.filter(n => !n.leida)
    : store.notifications;

  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 64 64" fill="none"><path d="M44 24a12 12 0 0 0-24 0c0 14-6 18-6 18h36s-6-4-6-18" stroke="currentColor" stroke-width="2"/><path d="M27 46a5 5 0 0 0 10 0" stroke="currentColor" stroke-width="2"/></svg><p>${store.notifHistoryFilter === 'unread' ? 'No tienes notificaciones sin leer.' : 'Aún no hay notificaciones en tu historial.'}</p></div>`;
  } else {
    list.innerHTML = items.map(buildNotifItem).join('');
  }
  const loadMoreBtn = $('btn-notif-load-more');
  if (loadMoreBtn) loadMoreBtn.hidden = !store.notifHasMore;
}

function renderAllNotifUI() {
  renderBell();
  renderDropdown();
  renderHistory();
}

/* ══════════════════════════════════════════════════════════════
   DROPDOWN — abrir / cerrar
══════════════════════════════════════════════════════════════ */
function openDropdown() {
  store.notifDropdownOpen = true;
  $('notif-dropdown')?.removeAttribute('hidden');
  $('btn-notif-bell')?.classList.add('is-open');
  $('btn-notif-bell')?.setAttribute('aria-expanded', 'true');
}
function closeDropdown() {
  store.notifDropdownOpen = false;
  $('notif-dropdown')?.setAttribute('hidden', '');
  $('btn-notif-bell')?.classList.remove('is-open');
  $('btn-notif-bell')?.setAttribute('aria-expanded', 'false');
}

/* ══════════════════════════════════════════════════════════════
   ACCIONES
══════════════════════════════════════════════════════════════ */
async function handleMarkAsRead(id) {
  const n = store.notifications.find(x => x.id === id);
  if (!n || n.leida) return;
  n.leida = true; // optimista
  store.unreadNotifCount = Math.max(0, store.unreadNotifCount - 1);
  renderAllNotifUI();
  try {
    await marcarLeida(id);
  } catch (e) {
    // revertir si falló
    n.leida = false;
    store.unreadNotifCount++;
    renderAllNotifUI();
    toast('❌ No se pudo marcar como leída', 'error');
  }
}

async function handleMarkAllRead() {
  const habiaNoLeidas = store.unreadNotifCount > 0;
  if (!habiaNoLeidas) return;
  store.notifications.forEach(n => { n.leida = true; });
  store.unreadNotifCount = 0;
  renderAllNotifUI();
  try {
    await marcarTodasLeidas();
    toast('✅ Notificaciones marcadas como leídas', 'success');
  } catch (e) {
    toast('❌ ' + e.message, 'error');
  }
}

async function handleDelete(id) {
  const idx = store.notifications.findIndex(n => n.id === id);
  if (idx === -1) return;
  const [eliminada] = store.notifications.splice(idx, 1);
  if (eliminada && !eliminada.leida) store.unreadNotifCount = Math.max(0, store.unreadNotifCount - 1);
  renderAllNotifUI();
  try {
    await eliminarNotificacion(id);
  } catch (e) {
    // revertir si falló
    store.notifications.splice(idx, 0, eliminada);
    if (eliminada && !eliminada.leida) store.unreadNotifCount++;
    renderAllNotifUI();
    toast('❌ No se pudo eliminar la notificación', 'error');
  }
}

function handleItemClick(id) {
  const n = store.notifications.find(x => x.id === id);
  if (!n) return;
  if (!n.leida) handleMarkAsRead(id);
  const tareaId = n.tareaId ?? n.tarea?.id;
  if (tareaId) {
    closeDropdown();
    window.navigateTo?.('tasks');
  }
}

async function loadMore() {
  const btn = $('btn-notif-load-more');
  const oldest = store.notifications.length ? store.notifications[store.notifications.length - 1].id : null;
  if (!oldest) return;
  btn?.setAttribute('disabled', 'true');
  try {
    const { notificaciones } = await listarNotificaciones({ limit: PAGE_SIZE, antesDeId: oldest });
    store.notifications.push(...notificaciones);
    store.notifHasMore = notificaciones.length === PAGE_SIZE;
    renderHistory();
  } catch (e) {
    toast('❌ ' + e.message, 'error');
  } finally {
    btn?.removeAttribute('disabled');
  }
}

/* ══════════════════════════════════════════════════════════════
   CARGA INICIAL + SSE
══════════════════════════════════════════════════════════════ */
export async function initNotifications() {
  try {
    const { notificaciones, noLeidas } = await listarNotificaciones({ limit: PAGE_SIZE });
    store.notifications = notificaciones;
    store.unreadNotifCount = noLeidas;
    store.notifHasMore = notificaciones.length === PAGE_SIZE;
  } catch (e) {
    console.error('Error cargando notificaciones:', e.message);
  }
  renderAllNotifUI();

  if (eventSource) eventSource.close();
  eventSource = abrirStreamNotificaciones(n => {
    // Evitar duplicados si por alguna razón ya llegó (reconexión, etc.)
    if (store.notifications.some(x => x.id === n.id)) return;
    store.notifications.unshift(n);
    if (!n.leida) store.unreadNotifCount++;
    renderAllNotifUI();
    toast(`🔔 ${n.titulo}`, 'default');

    // Cualquier notificación ligada a una tarea (asignada, reasignada,
    // actualizada, completada, eliminada, próxima a vencer/vencida)
    // implica que la lista de tareas cambió en el servidor: la
    // refrescamos sola para que se refleje sin recargar la página.
    if (n.tipo && n.tipo !== 'GENERAL') {
      refreshTasks();
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   EVENTOS
══════════════════════════════════════════════════════════════ */
export function attachNotifEvents() {
  $('btn-notif-bell')?.addEventListener('click', e => {
    e.stopPropagation();
    store.notifDropdownOpen ? closeDropdown() : openDropdown();
  });

  document.addEventListener('click', e => {
    if (store.notifDropdownOpen && !e.target.closest('.notif-bell-wrapper')) closeDropdown();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && store.notifDropdownOpen) closeDropdown();
  });

  $('btn-notif-mark-all')?.addEventListener('click', handleMarkAllRead);
  $('btn-notif-mark-all-history')?.addEventListener('click', handleMarkAllRead);

  $('btn-notif-ver-todas')?.addEventListener('click', () => {
    closeDropdown();
    window.navigateTo?.('notifications');
  });

  $('btn-notif-load-more')?.addEventListener('click', loadMore);

  // Filtro Todas / No leídas en el historial
  document.querySelectorAll('[data-notif-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-notif-filter]').forEach(b => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      store.notifHistoryFilter = btn.dataset.notifFilter;
      renderHistory();
    });
  });

  // Delegación de eventos: clic en un item o en su botón de eliminar.
  // Los contenedores son fijos en el HTML; su contenido se reemplaza
  // con innerHTML en cada render, así que basta un solo listener aquí.
  [$('notif-dropdown-list'), $('notif-history-list')].forEach(container => {
    container?.addEventListener('click', e => {
      const delBtn = e.target.closest('[data-del-id]');
      if (delBtn) {
        e.stopPropagation();
        handleDelete(parseInt(delBtn.dataset.delId, 10));
        return;
      }
      const item = e.target.closest('.notif-item');
      if (item) handleItemClick(parseInt(item.dataset.id, 10));
    });
  });
}
