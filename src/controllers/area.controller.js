const prisma = require('../prismaClient');

// ── POST /api/areas ──────────────────────────────────────────────
const crearArea = async (req, res) => {
  const { nombre } = req.body;

  if (!nombre?.trim()) {
    return res.status(400).json({ error: 'El nombre del área es obligatorio' });
  }

  try {
    const area = await prisma.area.create({
      data: { nombre: nombre.trim() },
    });
    res.status(201).json(area);
  } catch (error) {
    // P2002 = unique constraint (nombre duplicado)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: `El área "${nombre}" ya existe` });
    }
    console.error('Error crearArea:', error.message);
    res.status(500).json({ error: 'Error al crear área' });
  }
};

// ── GET /api/areas ───────────────────────────────────────────────
const listarAreas = async (req, res) => {
  try {
    const areas = await prisma.area.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: { select: { tareas: true } },  // cuántas tareas tiene cada área
      },
    });
    res.json(areas);
  } catch (error) {
    console.error('Error listarAreas:', error.message);
    res.status(500).json({ error: 'Error al listar áreas' });
  }
};

// ── GET /api/areas/:id ───────────────────────────────────────────
const obtenerArea = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const area = await prisma.area.findUnique({
      where: { id },
      include: {
        tareas: {
          select: { id: true, nombre: true, estado: true, fechaFin: true },
          orderBy: { fechaFin: 'asc' },
        },
      },
    });

    if (!area) return res.status(404).json({ error: 'Área no encontrada' });
    res.json(area);
  } catch (error) {
    console.error('Error obtenerArea:', error.message);
    res.status(500).json({ error: 'Error al obtener área' });
  }
};

// ── PUT /api/areas/:id ───────────────────────────────────────────
const actualizarArea = async (req, res) => {
  const id     = parseInt(req.params.id);
  const { nombre } = req.body;

  if (!nombre?.trim()) {
    return res.status(400).json({ error: 'El nombre del área es obligatorio' });
  }

  try {
    const area = await prisma.area.update({
      where: { id },
      data:  { nombre: nombre.trim() },
    });
    res.json(area);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Área no encontrada' });
    if (error.code === 'P2002') return res.status(400).json({ error: `El nombre "${nombre}" ya está en uso` });
    console.error('Error actualizarArea:', error.message);
    res.status(500).json({ error: 'Error al actualizar área' });
  }
};

// ── DELETE /api/areas/:id ────────────────────────────────────────
// Solo se puede eliminar si el área no tiene tareas asociadas
const eliminarArea = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const conteo = await prisma.tarea.count({ where: { areaId: id } });

    if (conteo > 0) {
      return res.status(400).json({
        error: `No se puede eliminar: el área tiene ${conteo} tarea(s) asignada(s)`,
      });
    }

    await prisma.area.delete({ where: { id } });
    res.json({ mensaje: 'Área eliminada correctamente' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Área no encontrada' });
    console.error('Error eliminarArea:', error.message);
    res.status(500).json({ error: 'Error al eliminar área' });
  }
};

module.exports = { crearArea, listarAreas, obtenerArea, actualizarArea, eliminarArea };