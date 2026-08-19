/**
 * ============================================================
 *  Comercializadora de Granos La Herradura — googleCalendar.service.js
 * ============================================================
 * Vinculación de cada usuario con su propia cuenta de Google
 * Calendar (OAuth2). Las tareas asignadas se reflejan como
 * eventos en el calendario del empleado asignado, de forma
 * automática al crear, editar o completar una tarea.
 *
 * Requiere las variables de entorno:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI   (ej. http://localhost:3000/api/google/callback)
 *   FRONTEND_URL          (ej. http://localhost:3000)  — a dónde redirigir tras el consentimiento
 */
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// ── Cliente OAuth2 "en blanco" (sin tokens de usuario) ───────────
function crearClienteOAuth() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

/**
 * Genera la URL de consentimiento de Google para que el usuario
 * conecte su cuenta. El `state` va firmado con el mismo JWT_SECRET
 * del proyecto para poder identificar de forma segura, en el
 * callback, a qué usuario pertenece la autorización (Google no
 * reenvía nuestro token de sesión).
 */
function generarUrlAutorizacion(usuarioId) {
  const oAuth2Client = crearClienteOAuth();
  const state = jwt.sign({ usuarioId }, process.env.JWT_SECRET, { expiresIn: '10m' });

  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',   // necesario para recibir refresh_token
    prompt: 'consent',        // fuerza a reemitir refresh_token si ya se había conectado antes
    scope: SCOPES,
    state,
  });
}

function verificarState(state) {
  const { usuarioId } = jwt.verify(state, process.env.JWT_SECRET);
  return usuarioId;
}

/**
 * Intercambia el código de autorización por tokens y los guarda en
 * el usuario. También obtiene el correo de la cuenta de Google
 * conectada, solo para mostrarlo en el perfil.
 */
async function conectarUsuario(usuarioId, code) {
  const oAuth2Client = crearClienteOAuth();
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  let email = null;
  try {
    const oauth2 = google.oauth2({ auth: oAuth2Client, version: 'v2' });
    const { data } = await oauth2.userinfo.get();
    email = data.email ?? null;
  } catch {
    // No es crítico si falla; simplemente no mostramos el correo.
  }

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      googleAccessToken:  tokens.access_token ?? null,
      // Google solo manda refresh_token la primera vez que el usuario
      // da consentimiento (o si se fuerza con prompt=consent); si no
      // viene uno nuevo, conservamos el que ya teníamos guardado.
      googleRefreshToken: tokens.refresh_token ?? undefined,
      googleTokenExpiry:  tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      googleCalendarEmail: email,
    },
  });
}

async function desconectarUsuario(usuarioId) {
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
      googleCalendarEmail: null,
    },
  });
}

/**
 * Devuelve un cliente OAuth2 ya autenticado y listo para usarse con
 * la API de Calendar, refrescando el access_token si hace falta y
 * persistiendo el nuevo token. Devuelve null si el usuario no tiene
 * Google Calendar conectado.
 */
async function obtenerClienteAutorizado(usuarioId) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario?.googleRefreshToken) return null;

  const oAuth2Client = crearClienteOAuth();
  oAuth2Client.setCredentials({
    access_token: usuario.googleAccessToken ?? undefined,
    refresh_token: usuario.googleRefreshToken,
    expiry_date: usuario.googleTokenExpiry ? usuario.googleTokenExpiry.getTime() : undefined,
  });

  // Persistir automáticamente cualquier token renovado por la librería.
  oAuth2Client.on('tokens', (tokens) => {
    const data = {};
    if (tokens.access_token) data.googleAccessToken = tokens.access_token;
    if (tokens.refresh_token) data.googleRefreshToken = tokens.refresh_token;
    if (tokens.expiry_date) data.googleTokenExpiry = new Date(tokens.expiry_date);
    if (Object.keys(data).length) {
      prisma.usuario.update({ where: { id: usuarioId }, data }).catch(() => {});
    }
  });

  return oAuth2Client;
}

/**
 * Construye el objeto de evento de Calendar a partir de una tarea.
 * fechaFin + hora definen el horario límite; el evento se marca de
 * 30 minutos para que aparezca como recordatorio puntual.
 */
function construirEvento(tarea) {
  const fecha = new Date(tarea.fechaFin);
  const [hh, mm] = (tarea.hora || '09:00').split(':').map(Number);
  fecha.setUTCHours(hh || 0, mm || 0, 0, 0);

  const inicio = fecha.toISOString();
  const fin = new Date(fecha.getTime() + 30 * 60 * 1000).toISOString();

  const prefijo = tarea.estado === 'COMPLETADA' ? '✅ ' : '';

  return {
    summary: `${prefijo}${tarea.nombre}`,
    description: [
      tarea.descripcion ?? '',
      `\nPrioridad: ${tarea.prioridad}`,
      `Estado: ${tarea.estado}`,
      `Tarea #${tarea.id} — La Herradura`,
    ].join('\n'),
    start: { dateTime: inicio },
    end:   { dateTime: fin },
  };
}

/**
 * Crea o actualiza el evento correspondiente a una tarea en el
 * calendario del usuario asignado. No hace nada (silenciosamente)
 * si ese usuario no tiene Google Calendar conectado, para no
 * bloquear el flujo normal de creación/edición de tareas.
 */
async function sincronizarTarea(tarea) {
  if (!tarea.asignadoAId) return;

  const auth = await obtenerClienteAutorizado(tarea.asignadoAId);
  if (!auth) return;

  const calendar = google.calendar({ version: 'v3', auth });
  const evento = construirEvento(tarea);

  try {
    if (tarea.googleEventId) {
      await calendar.events.update({
        calendarId: 'primary',
        eventId: tarea.googleEventId,
        requestBody: evento,
      });
    } else {
      const { data } = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: evento,
      });
      await prisma.tarea.update({
        where: { id: tarea.id },
        data: { googleEventId: data.id },
      });
    }
  } catch (error) {
    // Si el evento ya no existe en Google (borrado manualmente por el
    // usuario), se limpia la referencia y se reintenta creándolo de nuevo.
    if (error.code === 404 || error.code === 410) {
      const { data } = await calendar.events.insert({ calendarId: 'primary', requestBody: evento });
      await prisma.tarea.update({ where: { id: tarea.id }, data: { googleEventId: data.id } });
    } else {
      console.error('Error sincronizando tarea con Google Calendar:', error.message);
    }
  }
}

/**
 * Elimina el evento de Calendar asociado a una tarea (cuando la
 * tarea se borra o se reasigna a otra persona).
 */
async function eliminarEventoTarea(tarea) {
  if (!tarea.googleEventId || !tarea.asignadoAId) return;

  const auth = await obtenerClienteAutorizado(tarea.asignadoAId);
  if (!auth) return;

  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId: tarea.googleEventId });
  } catch (error) {
    if (error.code !== 404 && error.code !== 410) {
      console.error('Error eliminando evento de Google Calendar:', error.message);
    }
  }
}

module.exports = {
  generarUrlAutorizacion,
  verificarState,
  conectarUsuario,
  desconectarUsuario,
  obtenerClienteAutorizado,
  sincronizarTarea,
  eliminarEventoTarea,
};
