const express = require('express');
const router = express.Router();
const referenciaController = require('../controllers/referenciaController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { requireAuxEdit } = require('../middleware/auxPerm');

// Material Referencia
router.get('/material', requireAuth, referenciaController.listarMateriales);
router.post('/material', requireAuth, requireAuxEdit('referencia'), referenciaController.crearMaterial);
router.put('/material/:codigo_id', requireAuth, requireAuxEdit('referencia'), referenciaController.actualizarMaterial);
router.delete('/material/:codigo_id', requireAuth, requireAuxEdit('referencia'), referenciaController.eliminarMaterial);

// Historial Referencia
router.get('/historial/:codigo_material', requireAuth, referenciaController.listarHistorialPorMaterial);
router.post('/historial', requireAuth, requireAuxEdit('referencia'), referenciaController.crearHistorial);
router.put('/historial/:codigo_material/:consecutivo', requireAuth, requireAuxEdit('referencia'), referenciaController.actualizarHistorial);
router.get('/historial/next/:codigo_material', requireAuth, referenciaController.obtenerNextHistorial);

// Intervalo Referencia
router.get('/intervalo/:codigo_material', requireAuth, referenciaController.listarIntervaloPorMaterial);
router.post('/intervalo', requireAuth, requireAuxEdit('referencia'), referenciaController.crearIntervalo);
router.put('/intervalo/:codigo_material/:consecutivo', requireAuth, requireAuxEdit('referencia'), referenciaController.actualizarIntervalo);
router.get('/intervalo/next/:codigo_material', requireAuth, referenciaController.obtenerNextIntervalo);

// PDFs Referencia
router.get('/pdfs/:codigo', requireAuth, referenciaController.listarPdfsPorReferencia);
router.post('/pdfs/:codigo', requireAuth, requireAuxEdit('referencia'), upload.single('file'), referenciaController.subirPdfReferencia);
router.get('/pdfs/download/:id', referenciaController.descargarPdfReferencia); // Descarga pública
router.delete('/pdfs/:id', requireAuth, requireAuxEdit('referencia'), referenciaController.eliminarPdfReferencia);

// Compatibilidad con frontend existente
router.get('/pdf/:codigo', requireAuth, referenciaController.listarPdfsPorReferencia);
router.post('/pdf/upload', requireAuth, requireAuxEdit('referencia'), upload.single('archivo'), referenciaController.subirPdfReferencia);
router.get('/pdf/download/:id', referenciaController.descargarPdfReferencia); // Descarga pública
router.delete('/pdf/:id', requireAuth, requireAuxEdit('referencia'), referenciaController.eliminarPdfReferencia);

router.post('/documentos/generar', requireAuth, requireAuxEdit('referencia'), upload.single('template'), referenciaController.generarDocumentoReferencia);
router.get('/documentos/plantillas', requireAuth, referenciaController.listarPlantillasDocumentoReferencia);
router.post('/documentos/plantillas', requireAuth, requireAuxEdit('referencia'), upload.single('template'), referenciaController.subirPlantillaDocumentoReferencia);
router.delete('/documentos/plantillas/:id', requireAuth, requireAuxEdit('referencia'), referenciaController.eliminarPlantillaDocumentoReferencia);
router.post('/documentos/plantillas/:id/generar', requireAuth, requireAuxEdit('referencia'), referenciaController.generarDocumentoReferenciaDesdePlantilla);

module.exports = router;
