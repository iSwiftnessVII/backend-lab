const express = require('express');
const router = express.Router();
const referenciaController = require('../controllers/referenciaController');
const upload = require('../middleware/upload');

// Material Referencia
router.get('/material', referenciaController.listarMateriales);
router.post('/material', referenciaController.crearMaterial);
router.put('/material/:codigo_id', referenciaController.actualizarMaterial);
router.delete('/material/:codigo_id', referenciaController.eliminarMaterial);

// Historial Referencia
router.get('/historial/:codigo_material', referenciaController.listarHistorialPorMaterial);
router.post('/historial', referenciaController.crearHistorial);
router.put('/historial/:codigo_material/:consecutivo', referenciaController.actualizarHistorial);
router.get('/historial/next/:codigo_material', referenciaController.obtenerNextHistorial);

// Intervalo Referencia
router.get('/intervalo/:codigo_material', referenciaController.listarIntervaloPorMaterial);
router.post('/intervalo', referenciaController.crearIntervalo);
router.put('/intervalo/:codigo_material/:consecutivo', referenciaController.actualizarIntervalo);
router.get('/intervalo/next/:codigo_material', referenciaController.obtenerNextIntervalo);

// PDFs Referencia
router.get('/pdfs/:codigo', referenciaController.listarPdfsPorReferencia);
router.post('/pdfs/:codigo', upload.single('file'), referenciaController.subirPdfReferencia);
router.get('/pdfs/download/:id', referenciaController.descargarPdfReferencia);
router.delete('/pdfs/:id', referenciaController.eliminarPdfReferencia);

// Compatibilidad con frontend existente
router.get('/pdf/:codigo', referenciaController.listarPdfsPorReferencia);
router.post('/pdf/upload', upload.single('archivo'), referenciaController.subirPdfReferencia);
router.get('/pdf/download/:id', referenciaController.descargarPdfReferencia);
router.delete('/pdf/:id', referenciaController.eliminarPdfReferencia);

module.exports = router;
