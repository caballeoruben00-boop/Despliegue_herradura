/**
 * La Herradura — Dashboard: Usuarios
 * Directorio de usuarios (grid + filtros) y modal de creación/edición
 * de usuarios (alta, edición, desactivación, eliminación). Solo ADMIN.
 */
'use strict';

import {
  $, escHtml, showModal, hideModal, toast, store, session,
  isAdmin, canManageUsers, openConfirm, showModalError, clearModalErrors,
  getInitials,
} from './dashboard.core.js';
import {
  crearUsuario, actualizarUsuario,
  desactivarUsuario as desactivarUsuarioApi,
  eliminarUsuario as eliminarUsuarioApi,
} from './api.usuarios.js';
import { populateReportEmpleadoSelect } from './dashboard.reports.js';

/* ══════════════════════════════════════════════════════════════
   EMPLEADOS
══════════════════════════════════════════════════════════════ */
export function renderEmployees(filter = '') {
  const container = $('employee-grid');
  if (!container) return;
  let emps = store.users;

  if (filter) {
    const q = filter.toLowerCase();
    emps = emps.filter(e =>
      (e.nombre||'').toLowerCase().includes(q) ||
      (e.cargo||'').toLowerCase().includes(q) ||
      (e.numeroEmpleado||'').toLowerCase().includes(q)
    );
  }
  if (!emps.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>No se encontraron usuarios.</p></div>`;
    return;
  }
  container.innerHTML = emps.map(emp => buildEmployeeCard(emp)).join('');
  // populate empleado select en reportes
  populateReportEmpleadoSelect();
}

// Ya no hay filtro de tienda en el directorio de usuarios (no aplica).
export function populateEmployeeFilters() {}

function buildEmployeeCard(emp) {
  const statusLabel = emp.activo ? 'Activo' : 'Inactivo';
  const status = emp.activo ? 'active' : 'inactive';
  // Un admin puede editar su propia cuenta (sin desactivarse/eliminarse a
  // sí mismo) o la de cualquier usuario que NO sea ADMIN. No puede tocar
  // a otro administrador.
  const esUnoMismo = emp.id === session.id;
  const esAdminObjetivo = emp.rol === 'ADMIN';
  const puedeAdministrar = isAdmin && (esUnoMismo || !esAdminObjetivo);
  const adminActions = puedeAdministrar ? `
    <div class="employee-card__actions">
      <button class="task-btn task-btn--edit${emp.activo ? '' : ' task-btn--full'}" onclick="openEditUser(${emp.id})">✏️ Editar</button>
      ${(!esUnoMismo && emp.activo) ? `<button class="task-btn task-btn--edit" onclick="confirmDeactivateUser(${emp.id})">🚫 Desactivar</button>` : ''}
      ${!esUnoMismo ? `<button class="task-btn task-btn--delete" onclick="confirmDeleteUser(${emp.id})">🗑️ Eliminar</button>` : ''}
    </div>` : '';
  const roleClass = emp.rol === 'ADMIN' ? 'admin' : 'user';
  const roleLabel = emp.rol === 'ADMIN' ? '⭐ Administrador' : 'Usuario';
  // Estructura en 3 bloques (identidad / etiquetas / acciones) para que el
  // CSS pueda reordenarla: tarjeta centrada en escritorio y fila compacta
  // en teléfono.
  return `<div class="employee-card${emp.activo ? '' : ' employee-card--inactive'}" id="emp-card-${emp.id}" role="listitem">
    <div class="employee-card__head">
      <div class="employee-card__avatar" aria-hidden="true">${escHtml(getInitials(emp.nombre))}</div>
      <div class="employee-card__ident">
        <span class="employee-card__name">${escHtml(emp.nombre)}</span>
        <span class="employee-card__pos" title="${escHtml(emp.cargo || '')}">${escHtml(emp.cargo || '—')}</span>
        <span class="employee-card__num">${escHtml(emp.numeroEmpleado)}</span>
      </div>
    </div>
    <div class="employee-card__tags">
      <span class="employee-card__role employee-card__role--${roleClass}">${roleLabel}</span>
      <span class="employee-card__status">
        <span class="employee-card__status-dot employee-card__status-dot--${status}"></span>
        ${statusLabel}
      </span>
    </div>
    ${adminActions}
  </div>`;
}

window.openEditUser = function(id) {
  const emp = store.users.find(e => e.id === id);
  if (!emp) return;
  store.editingUserId = id;
  openUserModal(emp);
};

// Desactiva (soft delete) a un usuario: sigue existiendo, pero no
// puede iniciar sesión hasta reactivarse.
window.confirmDeactivateUser = function(id) {
  const emp = store.users.find(e => e.id === id);
  if (!emp) return;
  const esAdminObjetivo = emp.rol === 'ADMIN';
  const mensaje = esAdminObjetivo
    ? `¿Desactivar al administrador "${emp.nombre}"? Esta acción requiere la contraseña de ESE administrador.`
    : `¿Desactivar al usuario "${emp.nombre}"? Esta acción requiere tu contraseña.`;
  openConfirm(
    mensaje,
    async (password) => {
      try {
        const updated = await desactivarUsuarioApi(id, password);
        const u = store.users.find(e => e.id === id);
        if (u) Object.assign(u, updated);
        renderEmployees($('employee-search')?.value || '');
        toast('Usuario desactivado', 'success');
      } catch(e) { toast('❌ ' + e.message, 'error'); }
    },
    { title: 'Desactivar Usuario', okLabel: 'Desactivar', requirePassword: true }
  );
};

// Elimina (hard delete) definitivamente a un usuario.
window.confirmDeleteUser = function(id) {
  const emp = store.users.find(e => e.id === id);
  if (!emp) return;
  const esAdminObjetivo = emp.rol === 'ADMIN';
  const mensaje = esAdminObjetivo
    ? `¿Eliminar PERMANENTEMENTE al administrador "${emp.nombre}"? Esta acción requiere la contraseña de ESE administrador y no se puede deshacer.`
    : `¿Eliminar PERMANENTEMENTE al usuario "${emp.nombre}"? Esta acción requiere tu contraseña y no se puede deshacer.`;
  openConfirm(
    mensaje,
    async (password) => {
      try {
        await eliminarUsuarioApi(id, password);
        store.users = store.users.filter(e => e.id !== id);
        renderEmployees($('employee-search')?.value || '');
        toast('Usuario eliminado', 'success');
      } catch(e) { toast('❌ ' + e.message, 'error'); }
    },
    { title: 'Eliminar Usuario', okLabel: 'Eliminar', requirePassword: true }
  );
};

/* ══════════════════════════════════════════════════════════════
   MODAL USUARIOS
══════════════════════════════════════════════════════════════ */
export function openUserModal(user = null) {
  if (!canManageUsers) return;
  hideModal('modal-task-backdrop');
  hideModal('modal-confirm-backdrop');
  const hint = $('user-password-hint');

  const roleSel = $('user-role');
  if (roleSel) roleSel.disabled = false;

  if (user) {
    $('modal-user-title').textContent = 'Editar Usuario';
    $('user-edit-id').value      = user.id;
    $('user-name').value         = user.nombre;
    $('user-employee-num').value = user.numeroEmpleado;
    $('user-email').value        = user.email;
    $('user-position').value     = user.cargo || '';
    if (roleSel) roleSel.value = rolToSelectValue(user.rol);
    $('user-status').value       = user.activo ? 'active' : 'inactive';
    $('user-password').value     = '';
    $('user-password').required  = false;
    if (hint) hint.style.display = '';
  } else {
    $('modal-user-title').textContent = 'Crear Usuario';
    $('user-form').reset();
    $('user-edit-id').value = '';
    $('user-password').required = true;
    if (hint) hint.style.display = 'none';
  }
  clearModalErrors(['err-user-name','err-user-num','err-user-email','err-user-pos','err-user-password']);
  showModal('modal-user-backdrop');
}

function rolToSelectValue(rol) {
  if (rol === 'ADMIN') return 'admin';
  return 'user';
}

function selectValueToRol(val) {
  if (val === 'admin') return 'ADMIN';
  return 'EMPLEADO';
}

export function closeUserModal() {
  hideModal('modal-user-backdrop');
  store.editingUserId = null;
}

async function submitUser(e) {
  e.preventDefault();
  if (!canManageUsers) return;
  const nombre   = $('user-name').value.trim();
  const empNum   = $('user-employee-num').value.trim();
  const email    = $('user-email').value.trim();
  const pos      = $('user-position').value.trim();
  const password = $('user-password').value;
  const editId   = $('user-edit-id').value;
  const isNew    = !editId;

  let valid = true;
  if (!nombre) { showModalError('err-user-name',  $('user-name'),         'Nombre requerido.'); valid=false; }
  if (!empNum) { showModalError('err-user-num',   $('user-employee-num'), 'Número de empleado requerido.'); valid=false; }
  if (!email)  { showModalError('err-user-email', $('user-email'),        'Correo requerido.'); valid=false; }
  if (!pos)    { showModalError('err-user-pos',   $('user-position'),     'Cargo requerido.'); valid=false; }
  if (isNew && !password) { showModalError('err-user-password', $('user-password'), 'Contraseña requerida.'); valid=false; }
  if (!valid) return;

  const rolVal    = selectValueToRol($('user-role').value);
  const activoVal = $('user-status').value === 'active';

  try {
    if (editId) {
      const data = { nombre, cargo: pos, activo: activoVal, rol: rolVal };
      if (password) data.password = password;
      const updated = await actualizarUsuario(editId, data);
      const idx = store.users.findIndex(u => u.id == editId);
      if (idx !== -1) store.users[idx] = updated;
      toast('✏️ Usuario actualizado', 'success');
    } else {
      // generar username del nombre
      const username = nombre.toLowerCase().replace(/\s+/g, '.').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      const created = await crearUsuario({ nombre, username, numeroEmpleado: empNum, email, cargo: pos, password, rol: rolVal });
      store.users.push(created);
      toast('✅ Usuario creado', 'success');
      if (created.correoEnviado) {
        toast(`📧 Correo de bienvenida enviado a ${created.email}`, 'success');
      } else {
        toast('⚠️ El usuario se creó, pero el correo de bienvenida no se pudo enviar', 'error');
      }
    }
    closeUserModal();
    renderEmployees($('employee-search')?.value || '');
  } catch(err) {
    toast('❌ ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════════════════════════════
   EVENTOS — directorio y modal de empleados
══════════════════════════════════════════════════════════════ */
export function attachUserEvents() {
  // Nuevo usuario
  $('btn-sidebar-new-user')?.addEventListener('click', e => {
    e.preventDefault(); store.editingUserId=null; window.navigateTo('employees'); openUserModal();
  });
  $('btn-new-user')?.addEventListener('click', () => { store.editingUserId=null; openUserModal(); });

  // Modal usuario
  $('modal-user-close')?.addEventListener('click', closeUserModal);
  $('modal-user-cancel')?.addEventListener('click', closeUserModal);
  $('modal-user-backdrop')?.addEventListener('click', e => { if(e.target===$('modal-user-backdrop')) closeUserModal(); });
  $('user-form')?.addEventListener('submit', submitUser);

  $('user-pw-toggle')?.addEventListener('click', () => {
    const input=$('user-password'), show=$('user-pw-eye-show'), hide=$('user-pw-eye-hide');
    const visible = input.type==='text';
    input.type = visible ? 'password' : 'text';
    show.style.display = visible ? 'inline' : 'none';
    hide.style.display = visible ? 'none'   : 'inline';
  });

  // Búsqueda empleados
  $('employee-search')?.addEventListener('input', e => renderEmployees(e.target.value));

  // Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('modal-user-backdrop').hidden) { closeUserModal(); return; }
  });
}
