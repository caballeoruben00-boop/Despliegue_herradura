/**
 * Comercializadora de Granos La Herradura — Dashboard: Perfil
 * Modal para que cualquier usuario autenticado (típicamente un ADMIN)
 * cambie su propia contraseña.
 */
'use strict';

import {
  $, showModal, hideModal, toast, showModalError, clearModalErrors,
} from './dashboard.core.js';
import { cambiarMiPassword } from './api.usuarios.js';

function openPasswordModal() {
  const form = $('profile-password-form');
  if (form) form.reset();
  clearModalErrors(['err-profile-pw-actual', 'err-profile-pw-nueva', 'err-profile-pw-confirmar']);
  showModal('modal-profile-password-backdrop');
}

function closePasswordModal() {
  hideModal('modal-profile-password-backdrop');
}

async function submitPasswordChange(e) {
  e.preventDefault();
  const actual    = $('profile-pw-actual')?.value || '';
  const nueva     = $('profile-pw-nueva')?.value || '';
  const confirmar = $('profile-pw-confirmar')?.value || '';

  let valid = true;
  if (!actual) {
    showModalError('err-profile-pw-actual', $('profile-pw-actual'), 'Ingresa tu contraseña actual.');
    valid = false;
  }
  if (!nueva || nueva.length < 6) {
    showModalError('err-profile-pw-nueva', $('profile-pw-nueva'), 'La nueva contraseña debe tener al menos 6 caracteres.');
    valid = false;
  }
  if (nueva !== confirmar) {
    showModalError('err-profile-pw-confirmar', $('profile-pw-confirmar'), 'Las contraseñas no coinciden.');
    valid = false;
  }
  if (!valid) return;

  const btn = $('profile-pw-submit');
  btn?.setAttribute('disabled', 'true');

  try {
    await cambiarMiPassword(actual, nueva);
    toast('🔒 Contraseña actualizada correctamente', 'success');
    closePasswordModal();
  } catch (err) {
    showModalError('err-profile-pw-actual', $('profile-pw-actual'), err.message);
    toast('❌ ' + err.message, 'error');
  } finally {
    btn?.removeAttribute('disabled');
  }
}

export function attachProfileEvents() {
  $('btn-change-password')?.addEventListener('click', () => openPasswordModal());
  $('modal-profile-password-close')?.addEventListener('click', closePasswordModal);
  $('modal-profile-password-cancel')?.addEventListener('click', closePasswordModal);
  $('modal-profile-password-backdrop')?.addEventListener('click', e => {
    if (e.target === $('modal-profile-password-backdrop')) closePasswordModal();
  });
  $('profile-password-form')?.addEventListener('submit', submitPasswordChange);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('modal-profile-password-backdrop')?.hidden) closePasswordModal();
  });
}
