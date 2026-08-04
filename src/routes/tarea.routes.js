const express = require('express');
const {
  crearTarea, listarTareas, obtenerTarea,
  actualizarTarea, completarTarea, eliminarTarea,
} = require('../controllers/tarea.controller');
const {
  listarEvidencias, subirEvidencias, eliminarEvidencia,
} = require('../controllers/evidencia.controller');
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware');
const { uploadEvidencias } = require('../middlewares/upload.middleware');

const router = express.Router();

router.get('/',                  verificarToken,            listarTareas);
router.get('/:id',               verificarToken,            obtenerTarea);
router.post('/',                 verificarToken, soloAdmin,  crearTarea);
router.put('/:id',               verificarToken, soloAdmin,  actualizarTarea);
router.patch('/:id/completar',   verificarToken,            completarTarea);
router.delete('/:id',            verificarToken, soloAdmin, eliminarTarea);

// ── Evidencias (fotos y archivos adjuntos a la tarea) ───────────
router.get('/:id/evidencias',              verificarToken, listarEvidencias);
router.post('/:id/evidencias',             verificarToken, uploadEvidencias.array('archivos', 5), subirEvidencias);
router.delete('/:id/evidencias/:evidenciaId', verificarToken, eliminarEvidencia);

module.exports = router;
