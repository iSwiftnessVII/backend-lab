const express = require('express');
const router = express.Router();
const referenciaController = require('../controllers/referenciaController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Material Referencia
router.get('/material', requireAuth, referenciaController.listarMateriales);
router.post('/material', requireAuth, referenciaController.crearMaterial);
router.put('/material/:codigo_id', requireAuth, referenciaController.actualizarMaterial);
router.delete('/material/:codigo_id', requireAuth, referenciaController.eliminarMaterial);

// Historial Referencia
router.get('/historial/:codigo_material', requireAuth, referenciaController.listarHistorialPorMaterial);
router.post('/historial', requireAuth, referenciaController.crearHistorial);
router.put('/historial/:codigo_material/:consecutivo', requireAuth, referenciaController.actualizarHistorial);
router.get('/historial/next/:codigo_material', requireAuth, referenciaController.obtenerNextHistorial);

// Intervalo Referencia
router.get('/intervalo/:codigo_material', requireAuth, referenciaController.listarIntervaloPorMaterial);
router.post('/intervalo', requireAuth, referenciaController.crearIntervalo);
router.put('/intervalo/:codigo_material/:consecutivo', requireAuth, referenciaController.actualizarIntervalo);
router.get('/intervalo/next/:codigo_material', requireAuth, referenciaController.obtenerNextIntervalo);

// PDFs Referencia
router.get('/pdfs/:codigo', requireAuth, referenciaController.listarPdfsPorReferencia);
router.post('/pdfs/:codigo', requireAuth, upload.single('file'), referenciaController.subirPdfReferencia);
router.get('/pdfs/download/:id', referenciaController.descargarPdfReferencia); // Descarga pública
router.delete('/pdfs/:id', requireAuth, referenciaController.eliminarPdfReferencia);

// Compatibilidad con frontend existente
router.get('/pdf/:codigo', requireAuth, referenciaController.listarPdfsPorReferencia);
router.post('/pdf/upload', requireAuth, upload.single('archivo'), referenciaController.subirPdfReferencia);
router.get('/pdf/download/:id', referenciaController.descargarPdfReferencia); // Descarga pública
router.delete('/pdf/:id', requireAuth, referenciaController.eliminarPdfReferencia);

module.exports = router;
