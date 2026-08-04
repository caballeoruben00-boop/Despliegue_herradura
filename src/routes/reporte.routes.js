const express = require('express');
const {
  generarReporte, listarReportes, obtenerReporte,
  exportarReportePDF, eliminarReporte,
} = require('../controllers/reporte.controller');
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/',           verificarToken, soloAdmin, listarReportes);
router.get('/:id',        verificarToken, soloAdmin, obtenerReporte);
router.get('/:id/pdf',    verificarToken, soloAdmin, exportarReportePDF);
router.post('/',          verificarToken, soloAdmin, generarReporte);
router.delete('/:id',     verificarToken, soloAdmin, eliminarReporte);

module.exports = router;