const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../prismaClient');

const MAX_SESIONES_ACTIVAS = 2;

const login = async (req, res) => {
  const identificador = (req.body.identifier ?? req.body.username ?? '').trim();
  const { password } = req.body;

  try {
    if (!identificador || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
    }

    const usuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          { username: identificador },
          { numeroEmpleado: identificador },
          { email: { equals: identificador, mode: 'insensitive' } },
        ],
      },
    });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Limpia sesiones ya vencidas (más viejas que la duración del
    // token, 8h) para que no cuenten falsamente contra el límite.
    await prisma.sesionActiva.deleteMany({
      where: {
        usuarioId: usuario.id,
        ultimaActividad: { lt: new Date(Date.now() - 8 * 60 * 60 * 1000) },
      },
    });

    // ── Límite de 2 sesiones activas simultáneas ─────────────────
    // Si ya hay 2 dispositivos conectados, se cierra el más antiguo
    // (el de actividad menos reciente) para dejar entrar este nuevo.
    const sesiones = await prisma.sesionActiva.findMany({
      where: { usuarioId: usuario.id },
      orderBy: { ultimaActividad: 'asc' },
    });
    if (sesiones.length >= MAX_SESIONES_ACTIVAS) {
      const aEliminar = sesiones.slice(0, sesiones.length - MAX_SESIONES_ACTIVAS + 1);
      await prisma.sesionActiva.deleteMany({
        where: { id: { in: aEliminar.map(s => s.id) } },
      });
    }

    const jti = crypto.randomUUID();
    const dispositivo = (req.headers['user-agent'] || '').slice(0, 200);

    const token = jwt.sign(
      { id: usuario.id, username: usuario.username, rol: usuario.rol, nombre: usuario.nombre, jti },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await prisma.sesionActiva.create({ data: { usuarioId: usuario.id, jti, dispositivo } });

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        username: usuario.username,
        email: usuario.email,
        rol: usuario.rol,
      }
    });

  } catch (error) {
    console.error('Error login:', error.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Cierra la sesión actual: borra su registro de SesionActiva,
// liberando ese "cupo" de dispositivo.
const logout = async (req, res) => {
  try {
    if (req.usuario?.jti) {
      await prisma.sesionActiva.deleteMany({ where: { jti: req.usuario.jti } });
    }
    res.json({ mensaje: 'Sesión cerrada' });
  } catch (error) {
    console.error('Error logout:', error.message);
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
};

module.exports = { login, logout };
