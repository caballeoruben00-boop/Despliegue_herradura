const express = require('express');
const {
  listarNotificaciones, contarNoLeidas, marcarLeida,
  marcarTodasLeidas, eliminarNotificacion, streamNotificaciones,
  obtenerVapidPublicKey, guardarSuscripcionPush, eliminarSuscripcionPush,
  rotarSuscripcionPush,
} = require('../controllers/notificacion.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/stream', streamNotificaciones);

router.get('/push/vapid-public-key', obtenerVapidPublicKey);
router.post('/push/suscripcion',    verificarToken, guardarSuscripcionPush);
router.delete('/push/suscripcion',  verificarToken, eliminarSuscripcionPush);
// Sin auth: la llama el service worker en segundo plano (ver comentario en el controlador).
router.post('/push/suscripcion/rotar', rotarSuscripcionPush);

router.get('/',               verificarToken, listarNotificaciones);
router.get('/no-leidas',      verificarToken, contarNoLeidas);
router.patch('/leer-todas',   verificarToken, marcarTodasLeidas);
router.patch('/:id/leer',     verificarToken, marcarLeida);
router.delete('/:id',         verificarToken, eliminarNotificacion);

module.exports = router;
