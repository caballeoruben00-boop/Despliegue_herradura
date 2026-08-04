const express = require('express');
const {
  crearArea, listarAreas, obtenerArea,
  actualizarArea, eliminarArea,
} = require('../controllers/area.controller');
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/',       verificarToken,            listarAreas);
router.get('/:id',    verificarToken,            obtenerArea);
router.post('/',      verificarToken, soloAdmin,  crearArea);
router.put('/:id',    verificarToken, soloAdmin,  actualizarArea);
router.delete('/:id', verificarToken, soloAdmin,  eliminarArea);

module.exports = router;