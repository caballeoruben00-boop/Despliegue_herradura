const prisma = require('../prismaClient');
const { enviarPush } = require('./push.service');

// ══════════════════════════════════════════════════════════════
// REGISTRO DE CONEXIONES SSE (Server-Sent Events)
// ──────────────────────────────────────────────────────────────
// Cada usuario conectado al stream de notificaciones tiene una o más
// respuestas HTTP abiertas (puede tener el dashboard abierto en varias
// pestañas/dispositivos). Se guardan en un Map<usuarioId, Set<res>>
// en memoria: es suficiente para un solo proceso de Node como este.
// Si en el futuro se corre en varias instancias, esto debe moverse a
// un pub/sub externo (Redis, etc).
// ══════════════════════════════════════════════════════════════
const clientesSSE = new Map(); // usuarioId (Number) -> Set<res>

function registrarCliente(usuarioId, res) {
  if (!clientesSSE.has(usuarioId)) clientesSSE.set(usuarioId, new Set());
  clientesSSE.get(usuarioId).add(res);
}

function quitarCliente(usuarioId, res) {
  const set = clientesSSE.get(usuarioId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clientesSSE.delete(usuarioId);
}

// Envía un evento SSE a todas las conexiones abiertas de un usuario.
function enviarSSE(usuarioId, evento, datos) {
  const set = clientesSSE.get(usuarioId);
  if (!set || set.size === 0) return;
  const payload = `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { /* conexión ya cerrada, se limpiará con 'close' */ }
  }
}

// Tipos de notificación para los que además del push en tiempo real
// y el guardado en historial, también se manda un correo.
const TIPOS_CON_CORREO = new Set([
  'TAREA_ASIGNADA',
  'TAREA_PROXIMA_VENCER',
  'TAREA_VENCIDA',
  'TAREA_COMPLETADA',
]);

/**
 * Crea una notificación para un usuario: la guarda en la BD (historial),
 * la empuja en tiempo real por SSE si el usuario está conectado, y —
 * para ciertos tipos— dispara un correo. Nunca lanza: los fallos de
 * correo o de push no deben tumbar la operación que la originó
 * (crear/editar/completar una tarea).
 *
 * @param {{
 *   usuarioId: number,
 *   tipo: 'TAREA_ASIGNADA'|'TAREA_ACTUALIZADA'|'TAREA_PROXIMA_VENCER'|'TAREA_VENCIDA'|'TAREA_COMPLETADA'|'TAREA_ELIMINADA'|'GENERAL',
 *   titulo: string,
 *   mensaje: string,
 *   tareaId?: number|null,
 * }} datos
 */
async function crearNotificacion({ usuarioId, tipo = 'GENERAL', titulo, mensaje, tareaId = null }) {
  try {
    const notificacion = await prisma.notificacion.create({
      data: { usuarioId, tipo, titulo, mensaje, tareaId },
    });

    enviarSSE(usuarioId, 'notificacion', notificacion);

    if (TIPOS_CON_CORREO.has(tipo)) {
      const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { nombre: true, email: true },
      });
      if (usuario?.email) {
        // No se espera (fire-and-forget real vía .catch) para no retrasar
        // la respuesta de la petición que originó la notificación.
        enviarCorreoNotificacion(usuario, { titulo, mensaje 
                                          enviarPush(usuarioId, { titulo, mensaje, tareaId })
      .catch(err => console.error('❌ Error enviando push:', err.message));
          .catch(err => console.error('❌ Error enviando correo de notificación:', err.message));
      }
    }

    return notificacion;
  } catch (error) {
    console.error('❌ Error creando notificación:', error.message);
    return null;
  }
}

/**
 * Notifica a varios usuarios el mismo mensaje (p. ej. avisos generales).
 * Ignora duplicados de usuarioId.
 */
async function crearNotificacionMasiva(usuarioIds, datosComunes) {
  const ids = [...new Set(usuarioIds)];
  return Promise.all(ids.map(usuarioId => crearNotificacion({ ...datosComunes, usuarioId })));
}

module.exports = {
  registrarCliente,
  quitarCliente,
  crearNotificacion,
  crearNotificacionMasiva,
};
