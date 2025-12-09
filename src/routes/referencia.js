const express = require('express');
const router = express.Router();
const referenciaController = require('../controllers/referenciaController');
const upload = require('../middleware/upload');

// Material referencia routes
router.post('/', referenciaController.crearMaterial);
router.get('/', referenciaController.listarMateriales);
router.get('/:codigo', referenciaController.obtenerMaterialCompleto);
router.put('/:codigo', referenciaController.actualizarMaterial);
router.delete('/:codigo', referenciaController.eliminarMaterial);

// Historial routes
router.post('/historial', referenciaController.crearHistorial);
router.get('/historial/list/:codigo', referenciaController.listarHistorialPorMaterial);
router.get('/historial/next/:codigo', referenciaController.obtenerNextHistorial);
router.put('/historial/:codigo/:consecutivo', referenciaController.actualizarHistorial);

// Intervalo routes
router.post('/intervalo', referenciaController.crearIntervalo);
router.get('/intervalo/list/:codigo', referenciaController.listarIntervaloPorMaterial);
router.get('/intervalo/next/:codigo', referenciaController.obtenerNextIntervalo);
router.put('/intervalo/:codigo/:consecutivo', referenciaController.actualizarIntervalo);

// PDFs
router.get('/pdfs/:codigo', referenciaController.listarPdfsPorMaterial);
router.post('/pdfs/:codigo', upload.single('file'), referenciaController.subirPdfMaterial);
router.get('/pdfs/download/:id', referenciaController.descargarPdf);
router.delete('/pdfs/:id', referenciaController.eliminarPdf);

module.exports = router;
