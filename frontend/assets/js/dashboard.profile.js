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
import {
  obtenerUrlConexionGoogle, obtenerEstadoGoogle, desconectarGoogle,
} from './api.google.js';

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

/* ══════════════════════════════════════════════════════════════
   VINCULACIÓN CON GOOGLE CALENDAR
══════════════════════════════════════════════════════════════ */
async function refreshGoogleCalendarStatus() {
  const texto = $('google-calendar-status');
  const btnConectar = $('google-calendar-conectar');
  const btnDesconectar = $('google-calendar-desconectar');
  if (!texto) return;

  texto.textContent = 'Consultando estado…';
  btnConectar?.setAttribute('hidden', 'true');
  btnDesconectar?.setAttribute('hidden', 'true');

  try {
    const { conectado, email } = await obtenerEstadoGoogle();
    if (conectado) {
      texto.textContent = `✅ Conectado${email ? ' como ' + email : ''}`;
      btnDesconectar?.removeAttribute('hidden');
    } else {
      texto.textContent = '⛔ No conectado';
      btnConectar?.removeAttribute('hidden');
    }
  } catch (err) {
    texto.textContent = 'No se pudo consultar el estado.';
    toast('❌ ' + err.message, 'error');
  }
}

function openGoogleCalendarModal() {
  showModal('modal-google-calendar-backdrop');
  refreshGoogleCalendarStatus();
}

function closeGoogleCalendarModal() {
  hideModal('modal-google-calendar-backdrop');
}

async function iniciarConexionGoogle() {
  try {
    const { url } = await obtenerUrlConexionGoogle();
    // Se navega en la misma pestaña: Google redirige de vuelta a
    // dashboard.html cuando el usuario termina el consentimiento.
    window.location.href = url;
  } catch (err) {
    toast('❌ ' + err.message, 'error');
  }
}

async function desconectarGoogleCalendar() {
  try {
    await desconectarGoogle();
    toast('🔌 Google Calendar desvinculado', 'success');
    refreshGoogleCalendarStatus();
  } catch (err) {
    toast('❌ ' + err.message, 'error');
  }
}

/**
 * Revisa si venimos de regreso del flujo de consentimiento de Google
 * (?google=conectado|cancelado|error en la URL) y muestra un aviso,
 * limpiando después el parámetro de la barra de direcciones.
 */
function checkGoogleCalendarRedirect() {
  const params = new URLSearchParams(window.location.search);
  const resultado = params.get('google');
  if (!resultado) return;

  if (resultado === 'conectado') toast('✅ Google Calendar conectado correctamente', 'success');
  else if (resultado === 'cancelado') toast('Vinculación con Google Calendar cancelada', 'info');
  else toast('❌ No se pudo conectar Google Calendar. Intenta de nuevo.', 'error');

  params.delete('google');
  const nuevaUrl = window.location.pathname + (params.toString() ? `?${params}` : '');
  window.history.replaceState({}, '', nuevaUrl);
}

export function attachProfileEvents() {
  $('btn-change-password')?.addEventListener('click', () => openPasswordModal());
  $('modal-profile-password-close')?.addEventListener('click', closePasswordModal);
  $('modal-profile-password-cancel')?.addEventListener('click', closePasswordModal);
  $('modal-profile-password-backdrop')?.addEventListener('click', e => {
    if (e.target === $('modal-profile-password-backdrop')) closePasswordModal();
  });
  $('profile-password-form')?.addEventListener('submit', submitPasswordChange);

  $('btn-google-calendar')?.addEventListener('click', openGoogleCalendarModal);
  $('modal-google-calendar-close')?.addEventListener('click', closeGoogleCalendarModal);
  $('modal-google-calendar-backdrop')?.addEventListener('click', e => {
    if (e.target === $('modal-google-calendar-backdrop')) closeGoogleCalendarModal();
  });
  $('google-calendar-conectar')?.addEventListener('click', iniciarConexionGoogle);
  $('google-calendar-desconectar')?.addEventListener('click', desconectarGoogleCalendar);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('modal-profile-password-backdrop')?.hidden) closePasswordModal();
    if (!$('modal-google-calendar-backdrop')?.hidden) closeGoogleCalendarModal();
  });

  checkGoogleCalendarRedirect();
}
