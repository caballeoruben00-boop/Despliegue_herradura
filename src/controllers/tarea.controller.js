const prisma = require('../prismaClient');
const { crearNotificacion } = require('../services/notificacion.service');
const { marcarYNotificarVencidas } = require('../jobs/vencimientos.job');

// ── Incluye relaciones en todas las respuestas de tarea ─────────
const tareaInclude = {
  asignadoA: { select: { id: true, nombre: true, email: true, numeroEmpleado: true } },
  creadoPor: { select: { id: true, nombre: true } },
  _count: { select: { evidencias: true } },
};

// ── POST /api/tareas ─────────────────────────────────────────────
// Solo ADMIN puede crear tareas, y puede asignarlas a cualquier
// empleado activo (o a sí mismo/otro administrador).
const crearTarea = async (req, res) => {
  const { nombre, descripcion, fechaInicio, fechaFin, hora, prioridad, asignadoAId } = req.body;

  let asignado = (asignadoAId !== undefined && asignadoAId !== null && asignadoAId !== '')
    ? parseInt(asignadoAId)
    : null;

  // Validación básica de campos obligatorios
  if (!nombre || !fechaInicio || !fechaFin || !hora || !asignado) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, fechaInicio, fechaFin, hora, asignadoAId' });
  }

  try {
    const tarea = await prisma.tarea.create({
      data: {
        nombre,
        descripcion: descripcion ?? null,
        fechaInicio: new Date(fechaInicio),
        fechaFin:    new Date(fechaFin),
        hora,
        prioridad:   prioridad ?? 'MEDIA',
        asignadoAId: asignado,
        creadoPorId: req.usuario.id,
        // Se marca explícitamente el instante real de creación (en vez de
        // dejarlo solo al default de la BD) para que quede guardado con el
        // mismo criterio que completadaEn: un instante absoluto, correcto
        // sin importar la zona horaria configurada en el servidor de BD.
        // Al mostrarse (p. ej. en el PDF de reportes) se convierte a la
        // zona horaria local de la empresa.
        creadoEn:    new Date(),
      },
      include: tareaInclude,
    });

    // Avisar al empleado asignado, salvo que se la haya creado a sí mismo.
    if (tarea.asignadoAId !== req.usuario.id) {
      crearNotificacion({
        usuarioId: tarea.asignadoAId,
        tipo:      'TAREA_ASIGNADA',
        titulo:    'Nueva tarea asignada',
        mensaje:   `${tarea.creadoPor?.nombre ?? 'Alguien'} te asignó la tarea "${tarea.nombre}", con fecha límite ${new Date(tarea.fechaFin).toLocaleDateString('es-MX', { timeZone: 'UTC' })}.`,
        tareaId:   tarea.id,
      }).catch(() => {});
    }

    res.status(201).json(tarea);
  } catch (error) {
    console.error('Error crearTarea:', error.message);
    res.status(500).json({ error: 'Error al crear tarea' });
  }
};

// ── GET /api/tareas ──────────────────────────────────────────────
// ADMIN: ve todas las tareas (compartidas entre todos los
// administradores) y puede filtrar por estado o por asignado.
// EMPLEADO: solo puede ver sus propias tareas PENDIENTES (se ignora
// cualquier filtro de estado que envíe).
const listarTareas = async (req, res) => {
  const { estado, asignadoAId } = req.query;
  const esAdmin = req.usuario.rol === 'ADMIN';

  try {
    // Marcar atrasadas automáticamente antes de listar (y notificar al
    // empleado asignado la primera vez que se detecta el vencimiento).
    await marcarYNotificarVencidas();

    const where = {};

    if (esAdmin) {
      if (estado)      where.estado      = estado;
      if (asignadoAId) where.asignadoAId = parseInt(asignadoAId);
    } else {
      // Un empleado solo ve sus propias tareas pendientes.
      where.asignadoAId = req.usuario.id;
      where.estado      = 'PENDIENTE';
    }

    const tareas = await prisma.tarea.findMany({
      where,
      include:  tareaInclude,
      orderBy:  [{ prioridad: 'asc' }, { fechaFin: 'asc' }],
    });

    res.json(tareas);
  } catch (error) {
    console.error('Error listarTareas:', error.message);
    res.status(500).json({ error: 'Error al listar tareas' });
  }
};

// ── GET /api/tareas/:id ──────────────────────────────────────────
const obtenerTarea = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const tarea = await prisma.tarea.findUnique({
      where: { id },
      include: {
        ...tareaInclude,
        evidencias: {
          include: { subidoPor: { select: { id: true, nombre: true } } },
          orderBy: { creadoEn: 'desc' },
        },
      },
    });

    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    const esAdmin = req.usuario.rol === 'ADMIN';
    const propia  = tarea.asignadoAId === req.usuario.id;

    // Empleados solo pueden ver sus propias tareas.
    if (!esAdmin && !propia) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta tarea' });
    }

    res.json(tarea);
  } catch (error) {
    console.error('Error obtenerTarea:', error.message);
    res.status(500).json({ error: 'Error al obtener tarea' });
  }
};

// ── PUT /api/tareas/:id ──────────────────────────────────────────
// Solo ADMIN. Solo manda a Prisma los campos que vengan en el body
// (evita pisar con undefined).
const actualizarTarea = async (req, res) => {
  const id = parseInt(req.params.id);
  const { nombre, descripcion, fechaInicio, fechaFin, hora, prioridad, estado, asignadoAId } = req.body;

  try {
    const anterior = await prisma.tarea.findUnique({ where: { id } });
    if (!anterior) return res.status(404).json({ error: 'Tarea no encontrada' });

    const data = {};
    if (nombre      !== undefined) data.nombre      = nombre;
    if (descripcion !== undefined) data.descripcion = descripcion;
    if (fechaInicio !== undefined) data.fechaInicio = new Date(fechaInicio);
    if (fechaFin    !== undefined) data.fechaFin    = new Date(fechaFin);
    if (hora        !== undefined) data.hora        = hora;
    if (prioridad   !== undefined) data.prioridad   = prioridad;
    if (asignadoAId !== undefined) data.asignadoAId = parseInt(asignadoAId);

    if (estado !== undefined) {
      data.estado = estado;
      // Registra o limpia la fecha real de finalización según el cambio de estado.
      if (estado === 'COMPLETADA' && anterior.estado !== 'COMPLETADA') {
        data.completadaEn = new Date();
      } else if (estado !== 'COMPLETADA' && anterior.estado === 'COMPLETADA') {
        data.completadaEn = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    const tarea = await prisma.tarea.update({
      where:   { id },
      data,
      include: tareaInclude,
    });

    const actorId = req.usuario.id;
    const fueReasignada = data.asignadoAId !== undefined && data.asignadoAId !== anterior.asignadoAId;
    const fueCompletada  = data.estado === 'COMPLETADA' && anterior.estado !== 'COMPLETADA';

    if (fueReasignada) {
      // Avisar al nuevo asignado
      if (tarea.asignadoAId !== actorId) {
        crearNotificacion({
          usuarioId: tarea.asignadoAId,
          tipo:      'TAREA_ASIGNADA',
          titulo:    'Nueva tarea asignada',
          mensaje:   `${tarea.creadoPor?.nombre ?? 'Alguien'} te asignó la tarea "${tarea.nombre}", con fecha límite ${new Date(tarea.fechaFin).toLocaleDateString('es-MX', { timeZone: 'UTC' })}.`,
          tareaId:   tarea.id,
        }).catch(() => {});
      }
      // Avisar al asignado anterior de que ya no la tiene, si sigue existiendo
      if (anterior.asignadoAId !== actorId && anterior.asignadoAId !== tarea.asignadoAId) {
        crearNotificacion({
          usuarioId: anterior.asignadoAId,
          tipo:      'TAREA_ACTUALIZADA',
          titulo:    'Tarea reasignada',
          mensaje:   `La tarea "${tarea.nombre}" ya no está asignada a ti.`,
          tareaId:   tarea.id,
        }).catch(() => {});
      }
    } else if (!fueCompletada && tarea.asignadoAId !== actorId) {
      // Cambios relevantes (fecha, prioridad, nombre, etc.) sin reasignar
      const camposRelevantes = ['nombre', 'fechaFin', 'prioridad', 'hora', 'descripcion'];
      if (camposRelevantes.some(c => data[c] !== undefined)) {
        crearNotificacion({
          usuarioId: tarea.asignadoAId,
          tipo:      'TAREA_ACTUALIZADA',
          titulo:    'Tarea actualizada',
          mensaje:   `Se actualizaron los detalles de la tarea "${tarea.nombre}".`,
          tareaId:   tarea.id,
        }).catch(() => {});
      }
    }

    if (fueCompletada && tarea.creadoPorId !== actorId) {
      crearNotificacion({
        usuarioId: tarea.creadoPorId,
        tipo:      'TAREA_COMPLETADA',
        titulo:    'Tarea completada',
        mensaje:   `${tarea.asignadoA?.nombre ?? 'El empleado asignado'} completó la tarea "${tarea.nombre}".`,
        tareaId:   tarea.id,
      }).catch(() => {});
    }

    res.json(tarea);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Tarea no encontrada' });
    console.error('Error actualizarTarea:', error.message);
    res.status(500).json({ error: 'Error al actualizar tarea' });
  }
};

// ── PATCH /api/tareas/:id/completar ─────────────────────────────
const completarTarea = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const existente = await prisma.tarea.findUnique({ where: { id } });
    if (!existente) return res.status(404).json({ error: 'Tarea no encontrada' });

    const esAdmin = req.usuario.rol === 'ADMIN';
    if (!esAdmin && existente.asignadoAId !== req.usuario.id) {
      return res.status(403).json({ error: 'Solo puedes completar tareas asignadas a ti' });
    }

    const tarea = await prisma.tarea.update({
      where: { id },
      data:  { estado: 'COMPLETADA', completadaEn: new Date() },
      include: tareaInclude,
    });

    if (tarea.creadoPorId !== req.usuario.id) {
      crearNotificacion({
        usuarioId: tarea.creadoPorId,
        tipo:      'TAREA_COMPLETADA',
        titulo:    'Tarea completada',
        mensaje:   `${tarea.asignadoA?.nombre ?? 'El empleado asignado'} completó la tarea "${tarea.nombre}".`,
        tareaId:   tarea.id,
      }).catch(() => {});
    }

    res.json(tarea);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Tarea no encontrada' });
    console.error('Error completarTarea:', error.message);
    res.status(500).json({ error: 'Error al completar tarea' });
  }
};

// ── DELETE /api/tareas/:id ───────────────────────────────────────
// Las tareas son compartidas entre administradores: cualquier ADMIN
// puede eliminar cualquier tarea. Un EMPLEADO nunca puede eliminar
// tareas (ya no las crea).
const eliminarTarea = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const tarea = await prisma.tarea.findUnique({ where: { id } });
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    if (req.usuario.rol !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo un administrador puede eliminar tareas' });
    }

    if (tarea.asignadoAId !== req.usuario.id) {
      // No se referencia tareaId: la tarea se borra a continuación y
      // evitamos una condición de carrera con la FK de Notificacion.
      crearNotificacion({
        usuarioId: tarea.asignadoAId,
        tipo:      'TAREA_ELIMINADA',
        titulo:    'Tarea eliminada',
        mensaje:   `La tarea "${tarea.nombre}" fue eliminada por quien la creó.`,
      }).catch(() => {});
    }

    await prisma.tarea.delete({ where: { id } });
    res.json({ mensaje: 'Tarea eliminada correctamente' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Tarea no encontrada' });
    console.error('Error eliminarTarea:', error.message);
    res.status(500).json({ error: 'Error al eliminar tarea' });
  }
};

module.exports = { crearTarea, listarTareas, obtenerTarea, actualizarTarea, completarTarea, eliminarTarea };
