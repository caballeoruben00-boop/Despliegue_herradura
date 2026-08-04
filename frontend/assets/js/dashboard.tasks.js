/**
 * La Herradura — Dashboard: Tareas
 * Lista de tareas, filtros (estado/tiempo) y modal de
 * creación/edición de tareas (solo ADMIN).
 */
'use strict';

import {
  $, $$, escHtml, formatDate, getTaskStatus, labelStatus, labelPriority,
  showModal, hideModal, toast, store, session, isAdmin, canManageUsers,
  openConfirm, showModalError, clearModalErrors,
} from './dashboard.core.js';
import {
  crearTarea, actualizarTarea, completarTarea, eliminarTarea,
} from './api.tareas.js';
import {
  listarEvidencias, subirEvidencias, eliminarEvidencia,
} from './api.evidencias.js';
import { SERVER_URL } from './api.config.js';

// renderAll vive en dashboard.js (el orquestador). Se importa aquí para
// refrescar toda la UI tras crear/editar/completar/eliminar una tarea.
// Import circular intencional: solo se invoca dentro de manejadores de
// eventos, momento en el que todos los módulos ya están cargados.
import { renderAll } from './dashboard.js';

/* ══════════════════════════════════════════════════════════════
   TASK PREVIEW (panel general)
══════════════════════════════════════════════════════════════ */
export function renderTaskPreview() {
  const container = $('task-preview-list');
  if (!container) return;
  const recent = [...store.tasks].slice(0, 4);
  if (!recent.length) {
    container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 64 64" fill="none"><rect x="8" y="8" width="48" height="48" rx="8" stroke="currentColor" stroke-width="2"/><path d="M20 32h24M20 22h24M20 42h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><p>Aún no hay tareas registradas.</p></div>`;
    return;
  }
  container.innerHTML = recent.map(task => {
    const st = getTaskStatus(task);
    return `<div class="task-card task-card--${st}" style="cursor:pointer" onclick="navigateTo('tasks')">
      <div class="task-card__body">
        <span class="task-card__title">${escHtml(task.nombre)}</span>
        <div class="task-card__meta">
          <span class="task-card__meta-item">${formatDate(task.fechaFin)}</span>
          <span class="task-card__meta-item">${escHtml(task.asignadoA?.nombre || '—')}</span>
        </div>
      </div>
      <div class="task-card__actions">
        <span class="badge badge--${st}">${labelStatus(st)}</span>
        <span class="badge badge--${(task.prioridad||'').toLowerCase()}">${labelPriority(task.prioridad)}</span>
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════════
   LISTA DE TAREAS + FILTROS
══════════════════════════════════════════════════════════════ */
export function filteredTasks() {
  const f    = store.activeTaskFilter;
  const q    = store.activeTaskSearch.toLowerCase().trim();
  const time = store.activeTimeFilter;

  return store.tasks.filter(t => {
    const st = getTaskStatus(t);
    if (f === 'pending' && st !== 'pending') return false;
    if (f === 'done'    && st !== 'done')    return false;
    if (f === 'overdue' && st !== 'overdue') return false;

    if (time !== 'all') {
      const due = new Date(t.fechaFin);
      const now = new Date();
      if (time === 'day') {
        const today = new Date(); today.setHours(0,0,0,0);
        const end   = new Date(); end.setHours(23,59,59,999);
        if (due < today || due > end) return false;
      } else if (time === 'week') {
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
        if (due < mon || due > sun) return false;
      } else if (time === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        if (due < start || due > end) return false;
      }
    }

    if (q) {
      const hay = [t.nombre, t.descripcion, t.asignadoA?.nombre]
        .map(x => (x||'').toLowerCase()).some(x => x.includes(q));
      if (!hay) return false;
    }
    return true;
  });
}

export function renderTaskList() {
  const container = $('task-list');
  if (!container) return;
  const tasks = filteredTasks();
  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 64 64" fill="none"><rect x="8" y="8" width="48" height="48" rx="8" stroke="currentColor" stroke-width="2"/><path d="M20 32h24M20 22h24M20 42h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><p>No hay tareas con estos filtros.</p></div>`;
  } else {
    container.innerHTML = tasks.map(t => buildTaskCard(t)).join('');
  }
  updateFiltersUI(tasks.length);
}

function buildTaskCard(task) {
  const st = getTaskStatus(task);
  const canUndo = st === 'done';
  const pri = (task.prioridad || '').toLowerCase();

  const completeBtn = canUndo
    ? `<button class="task-btn task-btn--undo" onclick="toggleTask(${task.id})">↩️ Reabrir</button>`
    : `<button class="task-btn task-btn--complete" onclick="toggleTask(${task.id})">✔ Marcar lista</button>`;

  // Las tareas son compartidas entre administradores: cualquier ADMIN
  // puede editar o eliminar cualquier tarea.
  const editBtn = canManageUsers
    ? `<button class="task-btn task-btn--edit" onclick="openEditTask(${task.id})">✏️ Editar</button>`
    : '';
  const delBtn = canManageUsers
    ? `<button class="task-btn task-btn--delete" onclick="confirmDeleteTask(${task.id})">🗑️ Eliminar</button>`
    : '';
  const numEvidencias = task._count?.evidencias ?? 0;
  const evidBtn = `<button class="task-btn task-btn--evidencias" onclick="openEvidenciasModal(${task.id})">📎 Evidencias${numEvidencias ? ` (${numEvidencias})` : ''}</button>`;

  return `<div class="task-card task-card--${st}" id="task-card-${task.id}">
    <div class="task-card__body">
      <span class="task-card__title">${escHtml(task.nombre)}</span>
      ${task.descripcion ? `<p class="task-card__desc">${escHtml(task.descripcion)}</p>` : ''}
      <div class="task-card__meta">
        <span class="task-card__meta-item">📅 Término: ${formatDate(task.fechaFin)}</span>
        <span class="task-card__meta-item">👤 ${escHtml(task.asignadoA?.nombre || '—')}</span>
      </div>
    </div>
    <div class="task-card__actions">
      <span class="badge badge--${st}">${labelStatus(st)}</span>
      <span class="badge badge--${pri}">${labelPriority(task.prioridad)}</span>
      ${completeBtn}${evidBtn}${editBtn}${delBtn}
    </div>
  </div>`;
}

window.toggleTask = async function(id) {
  const task = store.tasks.find(t => t.id === id);
  if (!task) return;
  try {
    if (getTaskStatus(task) === 'done') {
      // reabrir → estado PENDIENTE
      const updated = await actualizarTarea(id, { estado: 'PENDIENTE' });
      Object.assign(task, updated);
      toast('↩️ Tarea reabierta', 'success');
    } else {
      const updated = await completarTarea(id);
      Object.assign(task, updated);
      toast('✅ Tarea completada', 'success');
    }
    renderAll();
  } catch(e) { toast('❌ ' + e.message, 'error'); }
};

window.confirmDeleteTask = function(id) {
  const task = store.tasks.find(t => t.id === id);
  if (!task) return;
  openConfirm(`¿Eliminar la tarea "${task.nombre}"?`, async () => {
    try {
      await eliminarTarea(id);
      store.tasks = store.tasks.filter(t => t.id !== id);
      renderAll();
      toast('🗑️ Tarea eliminada', 'success');
    } catch(e) { toast('❌ ' + e.message, 'error'); }
  });
};

window.openEditTask = function(id) {
  const task = store.tasks.find(t => t.id === id);
  if (!task) return;
  store.editingTaskId = id;
  openTaskModal(task);
};

/* ══════════════════════════════════════════════════════════════
   MODAL TAREAS
══════════════════════════════════════════════════════════════ */
function populateUserSelect(selectedUserId = '') {
  const sel = $('task-assignee');
  if (!sel) return;
  const candidatos = store.users.filter(u => u.activo !== false || u.id == selectedUserId);
  sel.innerHTML = '<option value="">— Selecciona usuario —</option>' +
    candidatos.map(u =>
      `<option value="${u.id}" ${u.id == selectedUserId ? 'selected' : ''}>${escHtml(u.nombre)}</option>`
    ).join('');
}

export function openTaskModal(task = null) {
  hideModal('modal-user-backdrop');
  hideModal('modal-confirm-backdrop');

  const assigneeSel = $('task-assignee');
  if (!canManageUsers) {
    // Un empleado no puede crear ni editar tareas (solo ADMIN).
    if (assigneeSel) {
      assigneeSel.innerHTML = `<option value="${session.id}" selected>${escHtml(session.nombre)} (tú)</option>`;
      assigneeSel.disabled = true;
    }
  } else {
    if (assigneeSel) assigneeSel.disabled = false;
    populateUserSelect(task?.asignadoAId || '');
  }

  if (task) {
    $('modal-task-title').textContent = 'Editar Tarea';
    $('task-edit-id').value = task.id;
    $('task-title').value   = task.nombre || '';
    $('task-report-date').value = task.fechaInicio ? task.fechaInicio.slice(0,10) : '';
    $('task-due').value     = task.fechaFin ? task.fechaFin.slice(0,10) : '';
    // hora
    const horaEl = $('task-hora');
    if (horaEl) horaEl.value = task.hora || '';
    // prioridad: mapear ALTA/MEDIA/BAJA ↔ high/medium/low
    const priMap = { ALTA: 'high', MEDIA: 'medium', BAJA: 'low' };
    $('task-priority').value = priMap[task.prioridad] || task.prioridad || '';
    $('task-status').value   = getTaskStatus(task) === 'done' ? 'done' : 'pending';
    $('task-desc').value     = task.descripcion || '';
    if ($('task-assignee')) $('task-assignee').value = task.asignadoAId || '';
  } else {
    $('modal-task-title').textContent = 'Nueva Tarea';
    $('task-form').reset();
    $('task-edit-id').value = '';
  }

  clearModalErrors(['err-task-title','err-task-report-date','err-task-due','err-task-priority']);
  showModal('modal-task-backdrop');
}

export function closeTaskModal() {
  hideModal('modal-task-backdrop');
  store.editingTaskId = null;
}

async function submitTask(e) {
  e.preventDefault();
  const nombre     = $('task-title').value.trim();
  const fechaInicio = $('task-report-date').value;
  const fechaFin   = $('task-due').value;
  const priorityRaw = $('task-priority').value;
  const hora       = $('task-hora')?.value || '08:00';
  const asignadoAId = canManageUsers ? ($('task-assignee')?.value || session.id) : session.id;

  // mapear high/medium/low → ALTA/MEDIA/BAJA
  const priMap = { high: 'ALTA', medium: 'MEDIA', low: 'BAJA', ALTA: 'ALTA', MEDIA: 'MEDIA', BAJA: 'BAJA' };
  const prioridad = priMap[priorityRaw] || 'MEDIA';

  let valid = true;
  if (!nombre)      { showModalError('err-task-title', $('task-title'), 'Escribe el nombre.');  valid=false; }
  if (!fechaInicio) { showModalError('err-task-report-date', $('task-report-date'), 'Selecciona fecha de reporte.'); valid=false; }
  if (!fechaFin)    { showModalError('err-task-due',   $('task-due'),   'Selecciona fecha límite.'); valid=false; }
  if (!valid) return;

  const payload = {
    nombre,
    fechaInicio, fechaFin, hora, prioridad,
    descripcion: $('task-desc').value.trim(),
    asignadoAId: parseInt(asignadoAId),
  };

  // estado si es edición
  const statusVal = $('task-status').value;
  if (statusVal === 'done') payload.estado = 'COMPLETADA';
  else payload.estado = 'PENDIENTE';

  try {
    const editId = $('task-edit-id').value;
    if (editId) {
      const updated = await actualizarTarea(editId, payload);
      const idx = store.tasks.findIndex(t => t.id == editId);
      if (idx !== -1) store.tasks[idx] = updated;
      toast('✏️ Tarea actualizada', 'success');
    } else {
      const created = await crearTarea(payload);
      store.tasks.unshift(created);
      toast('✅ Tarea creada', 'success');
    }
    closeTaskModal();
    renderAll();
  } catch(err) {
    toast('❌ ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════════════════════════════
   MODAL TAREA — agregar campo assignee y hora al HTML si no existen
══════════════════════════════════════════════════════════════ */
export function patchTaskModal() {
  // Agregar campo hora si no existe
  if (!$('task-hora')) {
    const dueGroup = $('task-due')?.closest('.mform-group');
    if (dueGroup) {
      const horaGroup = document.createElement('div');
      horaGroup.className = 'mform-group';
      horaGroup.innerHTML = `<label class="mform-label" for="task-hora">Hora *</label>
        <input type="time" id="task-hora" class="mform-input" value="08:00" required />`;
      dueGroup.after(horaGroup);
    }
  }
  // Agregar campo asignar a si no existe
  if (!$('task-assignee')) {
    const priorityGroup = $('task-priority')?.closest('.mform-group');
    if (priorityGroup) {
      const assignGroup = document.createElement('div');
      assignGroup.className = 'mform-group';
      assignGroup.innerHTML = `<label class="mform-label" for="task-assignee">Asignar a *</label>
        <select id="task-assignee" class="mform-input mform-select">
          <option value="">— Selecciona usuario —</option>
        </select>`;
      priorityGroup.after(assignGroup);
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   FILTROS UI
══════════════════════════════════════════════════════════════ */
function updateFiltersUI(count) {
  const el = $('filters-count-text');
  if (el) el.textContent = `${count} tarea${count !== 1 ? 's' : ''} encontrada${count !== 1 ? 's' : ''}`;
  const clearBtn = $('btn-clear-filters');
  const hasFilters = store.activeTaskFilter !== 'all' || store.activeTimeFilter !== 'all'
    || store.activeTaskSearch;
  if (clearBtn) clearBtn.hidden = !hasFilters;
}

function clearAllFilters() {
  store.activeTaskFilter = 'all';
  store.activeTimeFilter = 'all';
  store.activeTaskSearch = '';
  $$('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
  document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('filter-btn--active');
  $$('.time-btn').forEach(b => b.classList.remove('time-btn--active'));
  document.querySelector('.time-btn[data-time="all"]')?.classList.add('time-btn--active');
  const taskSearch = $('task-search');
  if (taskSearch) taskSearch.value = '';
  renderTaskList();
  toast('Filtros eliminados', 'success');
}

function toggleAdvancedFilters() {
  const btn  = $('btn-toggle-advanced-filters');
  const body = $('advanced-filters-body');
  if (!btn || !body) return;
  store.advancedFiltersOpen = !store.advancedFiltersOpen;
  if (store.advancedFiltersOpen) {
    body.removeAttribute('hidden'); body.style.display = 'block';
    btn.setAttribute('aria-expanded', 'true');
  } else {
    body.hidden = true; body.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
  }
}

/* ══════════════════════════════════════════════════════════════
   MODAL EVIDENCIAS (fotos y archivos adjuntos a una tarea)
══════════════════════════════════════════════════════════════ */
const EXTENSIONES_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

function iconoPorTipo(mime) {
  if (mime === 'application/pdf') return '📄';
  if (mime?.includes('word') || mime?.includes('msword')) return '📝';
  if (mime?.includes('excel') || mime?.includes('spreadsheet')) return '📊';
  return '📎';
}

function formatoTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

window.openEvidenciasModal = async function(taskId) {
  const task = store.tasks.find(t => t.id === taskId);
  if (!task) return;

  store.evidenciasTaskId = taskId;
  $('evidencias-task-name').textContent = task.nombre;
  $('evidencias-grid').innerHTML = '<p class="evidencias-loading">Cargando evidencias…</p>';
  $('evidencias-empty').hidden = true;
  hideModal('modal-task-backdrop');
  showModal('modal-evidencias-backdrop');

  try {
    const evidencias = await listarEvidencias(taskId);
    store.evidenciasActuales = evidencias;
    // Refleja el conteo actualizado en la tarjeta sin recargar todo
    if (task._count) task._count.evidencias = evidencias.length;
    renderEvidenciasGrid(evidencias);
  } catch (e) {
    $('evidencias-grid').innerHTML = '';
    toast('❌ ' + e.message, 'error');
  }
};

function closeEvidenciasModal() {
  hideModal('modal-evidencias-backdrop');
  store.evidenciasTaskId = null;
  store.evidenciasActuales = [];
}

function renderEvidenciasGrid(evidencias) {
  const grid = $('evidencias-grid');
  const empty = $('evidencias-empty');
  if (!evidencias.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const puedeBorrar = (ev) => isAdmin || ev.subidoPor?.id === session.id;

  grid.innerHTML = evidencias.map(ev => {
    const esImagen = EXTENSIONES_IMAGEN.has(ev.tipoMime);
    const url = `${SERVER_URL}${ev.rutaArchivo}`;
    const preview = esImagen
      ? `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${escHtml(ev.nombreOriginal)}" class="evidencia-card__img" /></a>`
      : `<a href="${url}" target="_blank" rel="noopener" class="evidencia-card__icon">${iconoPorTipo(ev.tipoMime)}</a>`;
    const delBtn = puedeBorrar(ev)
      ? `<button class="evidencia-card__del" title="Eliminar evidencia" onclick="deleteEvidencia(${ev.id})">🗑️</button>`
      : '';
    return `<div class="evidencia-card" id="evidencia-card-${ev.id}">
      ${preview}
      <div class="evidencia-card__info">
        <span class="evidencia-card__name" title="${escHtml(ev.nombreOriginal)}">${escHtml(ev.nombreOriginal)}</span>
        <span class="evidencia-card__meta">${formatoTamano(ev.tamano)} · ${escHtml(ev.subidoPor?.nombre || '—')}</span>
      </div>
      ${delBtn}
    </div>`;
  }).join('');
}

async function handleEvidenciasFileInput(e) {
  const files = e.target.files;
  if (!files || !files.length) return;
  const taskId = store.evidenciasTaskId;
  if (!taskId) return;

  if (files.length > 5) {
    toast('❌ Máximo 5 archivos a la vez', 'error');
    e.target.value = '';
    return;
  }

  const label = $('evidencias-upload')?.querySelector('.evidencias-upload__label span');
  const textoOriginal = label?.textContent;
  if (label) label.textContent = 'Subiendo…';

  try {
    const nuevas = await subirEvidencias(taskId, files);
    store.evidenciasActuales = [...nuevas, ...store.evidenciasActuales];
    renderEvidenciasGrid(store.evidenciasActuales);

    const task = store.tasks.find(t => t.id === taskId);
    if (task) {
      task._count = task._count || {};
      task._count.evidencias = store.evidenciasActuales.length;
      const card = document.getElementById(`task-card-${taskId}`);
      if (card) card.outerHTML = buildTaskCard(task);
    }
    toast(`✅ ${nuevas.length} evidencia${nuevas.length !== 1 ? 's' : ''} subida${nuevas.length !== 1 ? 's' : ''}`, 'success');
  } catch (err) {
    toast('❌ ' + err.message, 'error');
  } finally {
    if (label) label.textContent = textoOriginal;
    e.target.value = '';
  }
}

window.deleteEvidencia = function(evidenciaId) {
  const taskId = store.evidenciasTaskId;
  if (!taskId) return;
  openConfirm('¿Eliminar esta evidencia? No se puede deshacer.', async () => {
    try {
      await eliminarEvidencia(taskId, evidenciaId);
      store.evidenciasActuales = store.evidenciasActuales.filter(e => e.id !== evidenciaId);
      renderEvidenciasGrid(store.evidenciasActuales);

      const task = store.tasks.find(t => t.id === taskId);
      if (task) {
        task._count = task._count || {};
        task._count.evidencias = store.evidenciasActuales.length;
        const card = document.getElementById(`task-card-${taskId}`);
        if (card) card.outerHTML = buildTaskCard(task);
      }
      toast('🗑️ Evidencia eliminada', 'success');
    } catch (e) {
      toast('❌ ' + e.message, 'error');
    }
  });
};

function attachEvidenciasEvents() {
  $('modal-evidencias-close')?.addEventListener('click', closeEvidenciasModal);
  $('modal-evidencias-cerrar')?.addEventListener('click', closeEvidenciasModal);
  $('modal-evidencias-backdrop')?.addEventListener('click', e => {
    if (e.target === $('modal-evidencias-backdrop')) closeEvidenciasModal();
  });
  $('evidencias-file-input')?.addEventListener('change', handleEvidenciasFileInput);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('modal-evidencias-backdrop')?.hidden) closeEvidenciasModal();
  });
}

/* ══════════════════════════════════════════════════════════════
   EVENTOS — todo lo relacionado a tareas y sus filtros
══════════════════════════════════════════════════════════════ */
export function attachTaskEvents() {
  // Nueva tarea (solo ADMIN)
  $('btn-new-task')?.addEventListener('click', () => {
    if (!canManageUsers) return;
    store.editingTaskId=null; openTaskModal();
  });

  // Filtros estado
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b=>b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      store.activeTaskFilter = btn.dataset.filter;
      renderTaskList();
    });
  });

  // Filtros tiempo
  $$('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.time-btn').forEach(b=>b.classList.remove('time-btn--active'));
      btn.classList.add('time-btn--active');
      store.activeTimeFilter = btn.dataset.time;
      renderTaskList();
    });
  });

  $('btn-toggle-advanced-filters')?.addEventListener('click', toggleAdvancedFilters);
  $('btn-clear-filters')?.addEventListener('click', clearAllFilters);
  $('task-search')?.addEventListener('input', e => { store.activeTaskSearch=e.target.value; renderTaskList(); });

  // Modal tarea
  $('modal-task-close')?.addEventListener('click', closeTaskModal);
  $('modal-task-cancel')?.addEventListener('click', closeTaskModal);
  $('modal-task-backdrop')?.addEventListener('click', e => { if(e.target===$('modal-task-backdrop')) closeTaskModal(); });
  $('task-form')?.addEventListener('submit', submitTask);

  // Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('modal-task-backdrop').hidden) { closeTaskModal(); return; }
  });

  attachEvidenciasEvents();
}
