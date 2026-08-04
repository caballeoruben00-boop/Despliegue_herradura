const jwt    = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { registrarCliente, quitarCliente } = require('../services/notificacion.service');

// ── GET /api/notificaciones ──────────────────────────────────────
// Historial de notificaciones del usuario autenticado.
// Query: ?soloNoLeidas=true   → solo las no leídas
//        ?limit=20            → máximo de registros (default 30, tope 100)
//        ?antesDeId=N         → paginación: trae registros más antiguos que N
const listarNotificaciones = async (req, res) => {
  const usuarioId = req.usuario.id;
  const { soloNoLeidas, antesDeId } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);

  try {
    const where = { usuarioId };
    if (soloNoLeidas === 'true') where.leida = false;
    if (antesDeId) where.id = { lt: parseInt(antesDeId, 10) };

    const [notificaciones, noLeidas] = await Promise.all([
      prisma.notificacion.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        include: { tarea: { select: { id: true, nombre: true, estado: true } } },
      }),
      prisma.notificacion.count({ where: { usuarioId, leida: false } }),
    ]);

    res.json({ notificaciones, noLeidas });
  } catch (error) {
    console.error('Error listarNotificaciones:', error.message);
    res.status(500).json({ error: 'Error al listar notificaciones' });
  }
};

// ── GET /api/notificaciones/no-leidas ────────────────────────────
// Conteo rápido de no leídas (útil para refrescar el badge sin traer
// todo el historial, p. ej. justo después de reconectar el stream).
const contarNoLeidas = async (req, res) => {
  try {
    const noLeidas = await prisma.notificacion.count({
      where: { usuarioId: req.usuario.id, leida: false },
    });
    res.json({ noLeidas });
  } catch (error) {
    console.error('Error contarNoLeidas:', error.message);
    res.status(500).json({ error: 'Error al contar notificaciones' });
  }
};

// ── PATCH /api/notificaciones/:id/leer ───────────────────────────
const marcarLeida = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const notif = await prisma.notificacion.findUnique({ where: { id } });
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
    if (notif.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes permiso sobre esta notificación' });
    }

    const actualizada = await prisma.notificacion.update({
      where: { id },
      data: { leida: true },
    });
    res.json(actualizada);
  } catch (error) {
    console.error('Error marcarLeida:', error.message);
    res.status(500).json({ error: 'Error al marcar la notificación como leída' });
  }
};

// ── PATCH /api/notificaciones/leer-todas ─────────────────────────
const marcarTodasLeidas = async (req, res) => {
  try {
    const { count } = await prisma.notificacion.updateMany({
      where: { usuarioId: req.usuario.id, leida: false },
      data: { leida: true },
    });
    res.json({ actualizadas: count });
  } catch (error) {
    console.error('Error marcarTodasLeidas:', error.message);
    res.status(500).json({ error: 'Error al marcar notificaciones como leídas' });
  }
};

// ── DELETE /api/notificaciones/:id ───────────────────────────────
// Elimina una notificación del propio historial del usuario.
const eliminarNotificacion = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const notif = await prisma.notificacion.findUnique({ where: { id } });
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
    if (notif.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes permiso sobre esta notificación' });
    }

    await prisma.notificacion.delete({ where: { id } });
    res.json({ mensaje: 'Notificación eliminada' });
  } catch (error) {
    console.error('Error eliminarNotificacion:', error.message);
    res.status(500).json({ error: 'Error al eliminar la notificación' });
  }
};

// ── GET /api/notificaciones/stream ───────────────────────────────
// Conexión Server-Sent Events para notificaciones en tiempo real.
// EventSource (API nativa del navegador) no permite mandar headers
// personalizados, así que el token JWT viaja como query param
// (?token=...) en vez de en el header Authorization habitual.
const streamNotificaciones = async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

  let usuario;
  try {
    usuario = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }

  res.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no', // evita que un proxy (nginx) buferee el stream
  });
  res.write('retry: 5000\n\n');

  registrarCliente(usuario.id, res);

  // Ping periódico para mantener la conexión viva a través de proxies
  // que cierran conexiones inactivas.
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* se limpia con 'close' */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    quitarCliente(usuario.id, res);
  });
};
const obtenerVapidPublicKey = (req, res) => {
  const { vapidPublicKey } = require('../services/push.service');
  if (!vapidPublicKey) return res.status(503).json({ error: 'Push no configurado' });
  res.json({ publicKey: vapidPublicKey });
};

const guardarSuscripcionPush = async (req, res) => {
  const usuarioId = req.usuario.id;
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Suscripción push inválida' });
  }
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { usuarioId, p256dh: keys.p256dh, auth: keys.auth },
      create: { usuarioId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    res.status(201).json({ mensaje: 'Suscripción guardada' });
  } catch (error) {
    console.error('Error guardarSuscripcionPush:', error.message);
    res.status(500).json({ error: 'Error al guardar la suscripción' });
  }
};

const eliminarSuscripcionPush = async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Falta endpoint' });
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, usuarioId: req.usuario.id } });
    res.json({ mensaje: 'Suscripción eliminada' });
  } catch (error) {
    console.error('Error eliminarSuscripcionPush:', error.message);
    res.status(500).json({ error: 'Error al eliminar la suscripción' });
  }
};

module.exports = {
  listarNotificaciones,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
  eliminarNotificacion,
  streamNotificaciones,
  obtenerVapidPublicKey,
  guardarSuscripcionPush,
  eliminarSuscripcionPush,
};

