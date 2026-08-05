const bcrypt  = require('bcryptjs');
const prisma  = require('../prismaClient');
const { enviarCorreoBienvenida } = require('../services/email.service');

// Campos seguros a devolver (nunca el hash de contraseña)
const usuarioSelect = {
  id:             true,
  nombre:         true,
  username:       true,
  numeroEmpleado: true,
  email:          true,
  cargo:          true,
  rol:            true,
  activo:         true,
  creadoEn:       true,
};

// ── POST /api/usuarios ───────────────────────────────────────────
const crearUsuario = async (req, res) => {
  const { nombre, username, numeroEmpleado, email, cargo, password, rol } = req.body;

  if (!nombre || !username || !numeroEmpleado || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, username, numeroEmpleado, email, password' });
  }

  try {
    const existe = await prisma.usuario.findFirst({
      where: { OR: [{ email }, { numeroEmpleado }, { username }] },
    });

    if (existe) {
      return res.status(400).json({ error: 'El email, username o número de empleado ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        username,
        numeroEmpleado,
        email,
        cargo:    cargo ?? null,
        password: passwordHash,
        rol:      rol ?? 'EMPLEADO',
      },
      select: usuarioSelect,
    });

  // Enviar correo de bienvenida — esperamos el resultado para informar al frontend
    const correoEnviado = await enviarCorreoBienvenida(usuario, password);

    res.status(201).json({ ...usuario, correoEnviado });
  } catch (error) {
    console.error('Error crearUsuario:', error.message);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

// ── GET /api/usuarios ────────────────────────────────────────────
const listarUsuarios = async (req, res) => {
  try {
    const { activo } = req.query;

    const where = {};
    if (activo !== undefined) where.activo = activo === 'true';

    const usuarios = await prisma.usuario.findMany({
      where,
      select:  usuarioSelect,
      orderBy: { nombre: 'asc' },
    });

    res.json(usuarios);
  } catch (error) {
    console.error('Error listarUsuarios:', error.message);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
};

// ── GET /api/usuarios/:id ────────────────────────────────────────
const obtenerUsuario = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const usuario = await prisma.usuario.findUnique({
      where:  { id },
      select: usuarioSelect,
    });

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (error) {
    console.error('Error obtenerUsuario:', error.message);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
};

// Un ADMIN puede modificar su propia cuenta sin restricción, o la de
// cualquier usuario que NO sea ADMIN. No puede modificar a otro ADMIN.
const puedeModificarObjetivo = (usuarioActual, usuarioObjetivo) => {
  if (usuarioActual.id === usuarioObjetivo.id) return true;
  return usuarioObjetivo.rol !== 'ADMIN';
};

// ── PUT /api/usuarios/:id ────────────────────────────────────────
// Solo actualiza los campos recibidos — no pisa con undefined
const actualizarUsuario = async (req, res) => {
  const id = parseInt(req.params.id);
  const { nombre, cargo, activo, rol, password } = req.body;

  try {
    const objetivo = await prisma.usuario.findUnique({ where: { id } });
    if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!puedeModificarObjetivo(req.usuario, objetivo)) {
      return res.status(403).json({ error: 'No puedes modificar a otro administrador' });
    }
  } catch (error) {
    console.error('Error actualizarUsuario (validación de permisos):', error.message);
    return res.status(500).json({ error: 'Error al actualizar usuario' });
  }

  const data = {};
  if (nombre  !== undefined) data.nombre  = nombre;
  if (cargo   !== undefined) data.cargo   = cargo;
  if (activo  !== undefined) data.activo  = activo;
  if (rol     !== undefined) data.rol     = rol;
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
  }

  try {
    const usuario = await prisma.usuario.update({
      where:  { id },
      data,
      select: usuarioSelect,
    });
    res.json(usuario);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    console.error('Error actualizarUsuario:', error.message);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

// ── PATCH /api/usuarios/me/password ─────────────────────────────
// Cualquier usuario autenticado (típicamente un ADMIN) puede cambiar
// su propia contraseña. Requiere confirmar la contraseña actual.
const cambiarMiPassword = async (req, res) => {
  const { passwordActual, passwordNueva } = req.body;

  if (!passwordActual || !passwordNueva) {
    return res.status(400).json({ error: 'Debes enviar la contraseña actual y la nueva' });
  }
  if (passwordNueva.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const passwordValida = await bcrypt.compare(passwordActual, usuario.password);
    if (!passwordValida) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    const passwordHash = await bcrypt.hash(passwordNueva, 10);
    await prisma.usuario.update({
      where: { id: req.usuario.id },
      data:  { password: passwordHash },
    });

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error cambiarMiPassword:', error.message);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
};

// ── PATCH /api/usuarios/:id/desactivar ──────────────────────────
// Desactiva un usuario sin eliminarlo (soft delete)
// Requiere la contraseña del ADMIN que ejecuta la acción, como confirmación.
const desactivarUsuario = async (req, res) => {
  const id = parseInt(req.params.id);
  const { password } = req.body;

  // No se puede desactivar a uno mismo
  if (id === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Debes confirmar tu contraseña para eliminar un usuario' });
  }

  try {
    const objetivo = await prisma.usuario.findUnique({ where: { id } });
    if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!puedeModificarObjetivo(req.usuario, objetivo)) {
      return res.status(403).json({ error: 'No puedes desactivar a otro administrador' });
    }

    const admin = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    const passwordValida = admin && await bcrypt.compare(password, admin.password);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const usuario = await prisma.usuario.update({
      where:  { id },
      data:   { activo: false },
      select: usuarioSelect,
    });
    res.json(usuario);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    console.error('Error desactivarUsuario:', error.message);
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
};

// ── DELETE /api/usuarios/:id ────────────────────────────────────
// Elimina PERMANENTEMENTE a un usuario (hard delete).
// Requiere la contraseña del ADMIN que ejecuta la acción, como confirmación.
const eliminarUsuario = async (req, res) => {
  const id = parseInt(req.params.id);
  const { password } = req.body;

  // No se puede eliminar a uno mismo
  if (id === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Debes confirmar tu contraseña para eliminar un usuario' });
  }

  try {
    const objetivo = await prisma.usuario.findUnique({ where: { id } });
    if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!puedeModificarObjetivo(req.usuario, objetivo)) {
      return res.status(403).json({ error: 'No puedes eliminar a otro administrador' });
    }

    const admin = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    const passwordValida = admin && await bcrypt.compare(password, admin.password);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    await prisma.usuario.delete({ where: { id } });
    res.json({ mensaje: 'Usuario eliminado permanentemente' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });

    // Violación de llave foránea (el usuario tiene tareas asignadas o
    // creadas). Se detecta por varias vías porque, según el driver de
    // Prisma en uso, el código de error puede llegar distinto.
    const esErrorLlaveForanea =
      error.code === 'P2003' ||
      error.code === '23503' ||
      /foreign key|violates.*constraint/i.test(error.message || '');

    if (esErrorLlaveForanea) {
      return res.status(409).json({
        error: 'No se puede eliminar: este usuario tiene tareas asignadas o creadas. Desactívalo en su lugar para conservar el historial.',
      });
    }

    console.error('Error eliminarUsuario:', error.message);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

module.exports = {
  crearUsuario, listarUsuarios, obtenerUsuario, actualizarUsuario,
  cambiarMiPassword, desactivarUsuario, eliminarUsuario,
};
