const fs = require('fs');
const path = require('path');
const prisma = require('../prismaClient');
const { crearNotificacion } = require('../services/notificacion.service');
const { UPLOAD_DIR } = require('../middlewares/upload.middleware');

// Quién puede subir/borrar evidencias de una tarea:
// ADMIN, quien creó la tarea, o el empleado asignado a ella.
function puedeGestionarEvidencias(tarea, usuario) {
  return usuario.rol === 'ADMIN'
    || tarea.creadoPorId === usuario.id
    || tarea.asignadoAId === usuario.id;
}

// ── GET /api/tareas/:id/evidencias ──────────────────────────────
const listarEvidencias = async (req, res) => {
  const tareaId = parseInt(req.params.id);

  try {
    const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } });
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    if (req.usuario.rol !== 'ADMIN' && tarea.asignadoAId !== req.usuario.id && tarea.creadoPorId !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes permiso para ver las evidencias de esta tarea' });
    }

    const evidencias = await prisma.evidencia.findMany({
      where: { tareaId },
      include: { subidoPor: { select: { id: true, nombre: true } } },
      orderBy: { creadoEn: 'desc' },
    });

    res.json(evidencias);
  } catch (error) {
    console.error('Error listarEvidencias:', error.message);
    res.status(500).json({ error: 'Error al listar evidencias' });
  }
};

// ── POST /api/tareas/:id/evidencias ─────────────────────────────
// multipart/form-data, campo "archivos" (hasta 5 archivos)
const subirEvidencias = async (req, res) => {
  const tareaId = parseInt(req.params.id);
  const archivos = req.files || [];

  try {
    const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } });
    if (!tarea) {
      archivos.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    if (!puedeGestionarEvidencias(tarea, req.usuario)) {
      archivos.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(403).json({ error: 'No tienes permiso para subir evidencias a esta tarea' });
    }

    if (!archivos.length) {
      return res.status(400).json({ error: 'No se recibió ningún archivo. Usa el campo "archivos".' });
    }

    const creadas = await prisma.$transaction(
      archivos.map(f => prisma.evidencia.create({
        data: {
          nombreOriginal: f.originalname,
          nombreArchivo: f.filename,
          rutaArchivo: `/uploads/evidencias/${f.filename}`,
          tipoMime: f.mimetype,
          tamano: f.size,
          tareaId,
          subidoPorId: req.usuario.id,
        },
        include: { subidoPor: { select: { id: true, nombre: true } } },
      }))
    );

    // Notificar a la contraparte (si quien sube no es quien la tiene asignada)
    const destinatarioId = req.usuario.id === tarea.asignadoAId ? tarea.creadoPorId : tarea.asignadoAId;
    if (destinatarioId && destinatarioId !== req.usuario.id) {
      crearNotificacion({
        usuarioId: destinatarioId,
        tipo: 'TAREA_ACTUALIZADA',
        titulo: 'Nueva evidencia adjunta',
        mensaje: `Se ${archivos.length > 1 ? 'agregaron' : 'agregó'} ${archivos.length} ${archivos.length > 1 ? 'evidencias' : 'evidencia'} a la tarea "${tarea.nombre}".`,
        tareaId: tarea.id,
      }).catch(() => {});
    }

    res.status(201).json(creadas);
  } catch (error) {
    archivos.forEach(f => fs.unlink(f.path, () => {}));
    console.error('Error subirEvidencias:', error.message);
    res.status(500).json({ error: 'Error al subir evidencias' });
  }
};

// ── DELETE /api/tareas/:id/evidencias/:evidenciaId ──────────────
const eliminarEvidencia = async (req, res) => {
  const tareaId = parseInt(req.params.id);
  const evidenciaId = parseInt(req.params.evidenciaId);

  try {
    const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } });
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    const evidencia = await prisma.evidencia.findUnique({ where: { id: evidenciaId } });
    if (!evidencia || evidencia.tareaId !== tareaId) {
      return res.status(404).json({ error: 'Evidencia no encontrada' });
    }

    const puedeBorrar = req.usuario.rol === 'ADMIN'
      || evidencia.subidoPorId === req.usuario.id
      || tarea.creadoPorId === req.usuario.id;

    if (!puedeBorrar) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta evidencia' });
    }

    await prisma.evidencia.delete({ where: { id: evidenciaId } });

    // Borrar el archivo físico sin bloquear la respuesta si falla
    fs.unlink(path.join(UPLOAD_DIR, evidencia.nombreArchivo), () => {});

    res.json({ mensaje: 'Evidencia eliminada correctamente' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Evidencia no encontrada' });
    console.error('Error eliminarEvidencia:', error.message);
    res.status(500).json({ error: 'Error al eliminar evidencia' });
  }
};

module.exports = { listarEvidencias, subirEvidencias, eliminarEvidencia };
