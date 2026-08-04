/**
 * ============================================================
 *  La Herradura — Sistema de Administración
 *  login.js  (v3 — conectado al backend)
 * ============================================================
 *
 * CAMBIOS respecto a v2:
 *  - Se eliminó el array CONFIG.USERS hardcodeado.
 *  - handleSubmit ahora llama a login() de api.auth.js.
 *  - sessionStorage guarda { lh_token, lh_user } en vez de solo lh_user.
 *  - Los errores 401 del servidor se traducen al mismo mensaje de UI.
 *  - Todo lo demás (canvas, animaciones, validación) se conserva igual.
 */

'use strict';

import { login } from './api.auth.js';   // ← única línea nueva de importación

/* ── 1. CONFIGURACIÓN ───────────────────────────────────────── */
const CONFIG = {
  LOADING_DELAY: 800,      // ms de spinner antes de llamar al backend
  REDIRECT_URL:  'dashboard.html',
  MAX_ATTEMPTS:  5,
};


/* ── 2. REFERENCIAS AL DOM ──────────────────────────────────── */
const DOM = {
  form:           document.getElementById('login-form'),
  identifier:     document.getElementById('identifier'),
  password:       document.getElementById('password'),
  passwordToggle: document.getElementById('password-toggle'),
  eyeShow:        document.querySelector('.eye-icon--show'),
  eyeHide:        document.querySelector('.eye-icon--hide'),
  identifierErr:  document.getElementById('identifier-error'),
  passwordErr:    document.getElementById('password-error'),
  alert:          document.getElementById('login-alert'),
  alertText:      document.getElementById('login-alert-text'),
  btnLogin:       document.getElementById('btn-login'),
  yearSpan:       document.getElementById('year'),
};


/* ── 3. ESTADO ──────────────────────────────────────────────── */
const state = {
  attempts:        0,
  isLoading:       false,
  passwordVisible: false,
};


/* ── 4. INICIALIZACIÓN ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (DOM.yearSpan) DOM.yearSpan.textContent = new Date().getFullYear();

  // Si ya hay sesión activa, redirigir directamente
  if (sessionStorage.getItem('lh_token')) {
    window.location.href = CONFIG.REDIRECT_URL;
    return;
  }

  initCanvas();
  attachEventListeners();
  DOM.identifier.focus();
});


/* ── 5. UTILIDADES ──────────────────────────────────────────── */
const delay   = (ms) => new Promise((r) => setTimeout(r, ms));
const trimVal = (el) => el.value.trim();


/* ── 6. VALIDACIÓN ──────────────────────────────────────────── */
function validateIdentifier() {
  const val = trimVal(DOM.identifier);
  const g   = document.getElementById('group-identifier');
  if (!val) {
    setErr(g, DOM.identifierErr, 'Ingresa tu usuario, número de empleado o correo.');
    return false;
  }
  clearErr(g, DOM.identifierErr);
  return true;
}

function validatePassword() {
  const val = DOM.password.value;
  const g   = document.getElementById('group-password');
  if (!val) {
    setErr(g, DOM.passwordErr, 'Ingresa tu contraseña.');
    return false;
  }
  if (val.length < 6) {
    setErr(g, DOM.passwordErr, 'La contraseña debe tener al menos 6 caracteres.');
    return false;
  }
  clearErr(g, DOM.passwordErr);
  return true;
}

function setErr(g, el, msg) {
  g.classList.add('has-error');
  el.textContent = msg;
}

function clearErr(g, el) {
  g.classList.remove('has-error');
  el.textContent = '';
}


/* ── 7. MANEJO DEL FORMULARIO ───────────────────────────────── */
async function handleSubmit(e) {
  e.preventDefault();
  if (state.isLoading) return;

  DOM.alert.hidden = true;

  if (!validateIdentifier() | !validatePassword()) return;

  state.isLoading = true;
  DOM.btnLogin.classList.add('is-loading');
  DOM.btnLogin.setAttribute('aria-busy', 'true');

  await delay(CONFIG.LOADING_DELAY);

  try {
    // ── LLAMADA REAL AL BACKEND ──────────────────────────────
    await login(trimVal(DOM.identifier), DOM.password.value);
    // login() ya guarda lh_token y lh_user en sessionStorage
    handleLoginSuccess();

  } catch (err) {
    // El servidor devuelve 401 → "Credenciales inválidas"
    // O puede ser un error de red si el backend está caído
    state.attempts++;
    handleLoginError(err.message);

    state.isLoading = false;
    DOM.btnLogin.classList.remove('is-loading');
    DOM.btnLogin.removeAttribute('aria-busy');
  }
}

function handleLoginSuccess() {
  DOM.btnLogin.style.background = 'linear-gradient(135deg, #27AE60 0%, #2ECC71 100%)';
  DOM.btnLogin.style.boxShadow  = '0 6px 24px rgba(39,174,96,.4)';

  setTimeout(() => {
    window.location.href = CONFIG.REDIRECT_URL;
  }, 900);
}

function handleLoginError(serverMsg) {
  DOM.password.value = '';

  // Animación de sacudida
  [DOM.identifier, DOM.password].forEach((el) => {
    el.style.animation = '';
    void el.offsetWidth;
    el.style.animation = 'shakeIn 400ms cubic-bezier(0.4, 0, 0.2, 1)';
    el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
  });

  // Mensaje al usuario
  let msg;
  if (state.attempts >= CONFIG.MAX_ATTEMPTS) {
    msg = `Has superado ${CONFIG.MAX_ATTEMPTS} intentos fallidos. Contacta al administrador del sistema.`;
  } else if (serverMsg?.toLowerCase().includes('fetch') || serverMsg?.toLowerCase().includes('network')) {
    // Error de red (backend apagado)
    msg = 'No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.';
  } else {
    msg = 'Credenciales incorrectas. Verifica tus datos e intenta de nuevo.';
  }

  DOM.alertText.textContent = msg;
  DOM.alert.hidden           = false;
  DOM.alert.className        = 'form-alert form-alert--error';
  DOM.alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}


/* ── 8. TOGGLE DE CONTRASEÑA ────────────────────────────────── */
function togglePw() {
  state.passwordVisible = !state.passwordVisible;
  DOM.password.type            = state.passwordVisible ? 'text'    : 'password';
  DOM.eyeShow.style.display    = state.passwordVisible ? 'none'    : 'block';
  DOM.eyeHide.style.display    = state.passwordVisible ? 'block'   : 'none';
  DOM.passwordToggle.setAttribute(
    'aria-label',
    state.passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'
  );
}


/* ── 9. EVENTOS ─────────────────────────────────────────────── */
function attachEventListeners() {
  DOM.form.addEventListener('submit', handleSubmit);

  DOM.identifier.addEventListener('blur',  validateIdentifier);
  DOM.password.addEventListener('blur',    validatePassword);

  DOM.identifier.addEventListener('input', () => {
    clearErr(document.getElementById('group-identifier'), DOM.identifierErr);
    DOM.alert.hidden = true;
  });
  DOM.password.addEventListener('input', () => {
    clearErr(document.getElementById('group-password'), DOM.passwordErr);
    DOM.alert.hidden = true;
  });

  DOM.passwordToggle.addEventListener('click', togglePw);
  DOM.passwordToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePw(); }
  });
}


/* ── 10. CANVAS — PARTÍCULAS DE FONDO ──────────────────────── */
function initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let w, h, particles;

  function resize() {
    w = canvas.width  = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  class P {
    constructor() { this.reset(true); }

    reset(rand = false) {
      this.x    = Math.random() * w;
      this.y    = rand ? Math.random() * h : h + 20;
      this.size = Math.random() * 3 + 1;
      this.vy   = -(Math.random() * 0.4 + 0.15);
      this.vx   = (Math.random() - 0.5) * 0.3;
      this.op   = Math.random() * 0.25 + 0.05;
      this.c    = Math.random() < 0.6
        ? `rgba(232, ${140 + Math.floor(Math.random() * 60)}, 50, ${this.op})`
        : `rgba(${140 + Math.floor(Math.random() * 60)}, 90, 20, ${this.op})`;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.y < -20) this.reset();
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.vx * 10);
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size, this.size * 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = this.c;
      ctx.fill();
      ctx.restore();
    }
  }

  function loop() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach((p) => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  }

  resize();
  particles = Array.from({ length: 80 }, () => new P());
  loop();

  window.addEventListener('resize', () => {
    resize();
    particles = Array.from({ length: 80 }, () => new P());
  });
}
