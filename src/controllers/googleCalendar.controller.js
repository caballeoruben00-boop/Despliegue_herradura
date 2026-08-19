const prisma = require('../prismaClient');
const googleService = require('../services/googleCalendar.service');

// ── GET /api/google/conectar ─────────────────────────────────────
// Devuelve la URL a la que el frontend debe redirigir al usuario
// para que autorice el acceso a su Google Calendar.
const obtenerUrlConexion = async (req, res) => {
  try {
    const url = googleService.generarUrlAutorizacion(req.usuario.id);
    res.json({ url });
  } catch (error) {
    console.error('Error generando URL de Google:', error.message);
    res.status(500).json({ error: 'No se pudo generar la URL de autorización' });
  }
};

// ── GET /api/google/callback ─────────────────────────────────────
// Google redirige aquí después de que el usuario da (o niega) su
// consentimiento. No lleva el JWT de sesión (es una navegación del
// propio navegador), así que la identidad del usuario viaja en el
// parámetro `state` firmado que generamos en obtenerUrlConexion.
const callback = async (req, res) => {
  const { code, state, error: errorGoogle } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || '/';

  if (errorGoogle) {
    return res.redirect(`${frontendUrl}/dashboard.html?google=cancelado`);
  }

  try {
    const usuarioId = googleService.verificarState(state);
    await googleService.conectarUsuario(usuarioId, code);
    res.redirect(`${frontendUrl}/dashboard.html?google=conectado`);
  } catch (error) {
    console.error('Error en callback de Google:', error.message);
    res.redirect(`${frontendUrl}/dashboard.html?google=error`);
  }
};

// ── GET /api/google/estado ────────────────────────────────────────
const obtenerEstado = async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { googleRefreshToken: true, googleCalendarEmail: true },
    });
    res.json({
      conectado: !!usuario?.googleRefreshToken,
      email: usuario?.googleCalendarEmail ?? null,
    });
  } catch (error) {
    console.error('Error obteniendo estado de Google:', error.message);
    res.status(500).json({ error: 'Error al consultar el estado de la vinculación' });
  }
};

// ── POST /api/google/desconectar ──────────────────────────────────
const desconectar = async (req, res) => {
  try {
    await googleService.desconectarUsuario(req.usuario.id);
    res.json({ mensaje: 'Google Calendar desvinculado correctamente' });
  } catch (error) {
    console.error('Error desconectando Google:', error.message);
    res.status(500).json({ error: 'No se pudo desvincular Google Calendar' });
  }
};

module.exports = { obtenerUrlConexion, callback, obtenerEstado, desconectar };
