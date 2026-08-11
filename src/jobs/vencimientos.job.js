const prisma = require('../prismaClient');
const { crearNotificacion } = require('../services/notificacion.service');

const QUINCE_MINUTOS = 15 * 60 * 1000;
const VENTANA_PROXIMA_VENCER_HORAS = 24;

/**
 * Busca tareas PENDIENTE cuya fecha límite ya pasó, las marca como
 * ATRASADA y notifica al empleado asignado (una sola vez: en cuanto
 * cambian de estado dejan de calificar para esta consulta).
 *
 * Se llama tanto desde el job periódico como desde
 * GET /api/tareas (que ya marcaba las atrasadas, solo que sin avisar),
 * así el aviso sale en el momento en que alguien realmente detecta
 * el vencimiento, sin esperar al siguiente ciclo del job.
 */
async function marcarYNotificarVencidas() {
  const ahora = new Date();

  const vencidas = await prisma.tarea.findMany({
    where: { estado: 'PENDIENTE', fechaFin: { lt: ahora } },
    select: { id: true, nombre: true, asignadoAId: true },
  });

  if (!vencidas.length) return;

  await prisma.tarea.updateMany({
    where: { id: { in: vencidas.map(t => t.id) } },
    data:  { estado: 'ATRASADA' },
  });

  await Promise.all(vencidas.map(t => crearNotificacion({
    usuarioId: t.asignadoAId,
    tipo:      'TAREA_VENCIDA',
    titulo:    'Tarea atrasada',
    mensaje:   `La tarea "${t.nombre}" pasó su fecha límite y ahora está marcada como atrasada.`,
    tareaId:   t.id,
  })));
}

/**
 * Busca tareas PENDIENTE que vencen dentro de las próximas 24 horas y
 * que todavía no generaron un aviso de "próxima a vencer", y notifica
 * al empleado asignado. Se evita repetir el aviso comprobando si ya
 * existe una notificación de ese tipo para la tarea.
 */
async function notificarProximasAVencer() {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + VENTANA_PROXIMA_VENCER_HORAS * 60 * 60 * 1000);

  const candidatas = await prisma.tarea.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaFin: { gte: ahora, lte: limite },
    },
    select: { id: true, nombre: true, fechaFin: true, asignadoAId: true },
  });

  if (!candidatas.length) return;

  const yaNotificadas = await prisma.notificacion.findMany({
    where: {
      tipo: 'TAREA_PROXIMA_VENCER',
      tareaId: { in: candidatas.map(t => t.id) },
    },
    select: { tareaId: true },
  });
  const idsYaNotificados = new Set(yaNotificadas.map(n => n.tareaId));

  const pendientesDeAvisar = candidatas.filter(t => !idsYaNotificados.has(t.id));

  await Promise.all(pendientesDeAvisar.map(t => crearNotificacion({
    usuarioId: t.asignadoAId,
    tipo:      'TAREA_PROXIMA_VENCER',
    titulo:    'Tarea próxima a vencer',
    mensaje:   `La tarea "${t.nombre}" vence el ${new Date(t.fechaFin).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' })}.`,
    tareaId:   t.id,
  })));
}

async function ejecutarCiclo() {
  try {
    await marcarYNotificarVencidas();
    await notificarProximasAVencer();
  } catch (error) {
    console.error('❌ Error en job de vencimientos:', error.message);
  }
}

/**
 * Arranca el job en segundo plano: corre una vez de inmediato (con un
 * pequeño retraso para no competir con el arranque del servidor) y
 * luego cada 15 minutos.
 */
function iniciarJobVencimientos() {
  setTimeout(ejecutarCiclo, 5000);
  setInterval(ejecutarCiclo, QUINCE_MINUTOS);
}

module.exports = { iniciarJobVencimientos, marcarYNotificarVencidas, notificarProximasAVencer };
