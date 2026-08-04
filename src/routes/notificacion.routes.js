const express = require('express');
const {
  listarNotificaciones, contarNoLeidas, marcarLeida,
  marcarTodasLeidas, eliminarNotificacion, streamNotificaciones,
} = require('../controllers/notificacion.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// El stream SSE se autentica a mano dentro del controlador (el token
// viaja por query string, no por header), por eso NO lleva
// `verificarToken` aquí.
router.get('/stream', streamNotificaciones);

router.get('/',               verificarToken, listarNotificaciones);
router.get('/no-leidas',      verificarToken, contarNoLeidas);
router.patch('/leer-todas',   verificarToken, marcarTodasLeidas);
router.patch('/:id/leer',     verificarToken, marcarLeida);
router.delete('/:id',         verificarToken, eliminarNotificacion);

module.exports = router;
