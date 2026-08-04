const express = require('express');
const {
  crearUsuario, listarUsuarios, obtenerUsuario,
  actualizarUsuario, cambiarMiPassword, desactivarUsuario, eliminarUsuario,
} = require('../controllers/usuario.controller');
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

// IMPORTANTE: la ruta /me/password debe ir ANTES de /:id para que
// Express no la confunda con un id.
router.patch('/me/password',      verificarToken,            cambiarMiPassword);

router.get('/',                   verificarToken,            listarUsuarios);
router.get('/:id',                verificarToken,            obtenerUsuario);
router.post('/',                  verificarToken, soloAdmin,  crearUsuario);
router.put('/:id',                verificarToken, soloAdmin,  actualizarUsuario);
router.patch('/:id/desactivar',   verificarToken, soloAdmin,  desactivarUsuario);
router.delete('/:id',             verificarToken, soloAdmin,  eliminarUsuario);

module.exports = router;
