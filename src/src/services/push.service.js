const webpush = require('web-push');
const prisma = require('../prismaClient');

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

const configurado = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (configurado) {
  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:soporte@laherradura.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configurados. No se enviarán notificaciones push.');
}

async function enviarPush(usuarioId, { titulo, mensaje, tareaId = null }) {
  if (!configurado) return;

  const suscripciones = await prisma.pushSubscription.findMany({ where: { usuarioId } });
  if (suscripciones.length === 0) return;

  const payload = JSON.stringify({ titulo, mensaje, tareaId, url: '/dashboard.html' });

  await Promise.all(suscripciones.map(async (sub) => {
    const suscripcion = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    try {
      await webpush.sendNotification(suscripcion, payload);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error('❌ Error enviando push:', error.message);
      }
    }
  }));
}

module.exports = { enviarPush, vapidPublicKey: VAPID_PUBLIC_KEY };
