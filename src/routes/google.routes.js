const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const {
  obtenerUrlConexion, callback, obtenerEstado, desconectar,
} = require('../controllers/googleCalendar.controller');

// El callback lo invoca Google directamente en el navegador del
// usuario (no trae header Authorization), así que va sin middleware
// de autenticación; la identidad viaja en el `state` firmado.
router.get('/callback', callback);

router.use(verificarToken);
router.get('/conectar', obtenerUrlConexion);
router.get('/estado', obtenerEstado);
router.post('/desconectar', desconectar);

module.exports = router;
