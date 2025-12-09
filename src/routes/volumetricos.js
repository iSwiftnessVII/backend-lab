const express = require('express');
const router = express.Router();
const volumetricosController = require('../controllers/volumetricosController');

// Material Volumétrico routes
router.post('/', volumetricosController.crearMaterial);
router.get('/', volumetricosController.listarMateriales);
router.get('/:codigo', volumetricosController.obtenerMaterialCompleto);
router.put('/:codigo', volumetricosController.actualizarMaterial);
router.delete('/:codigo', volumetricosController.eliminarMaterial);

// Historial routes
router.post('/historial', volumetricosController.crearHistorial);
router.get('/historial/list/:codigo', volumetricosController.listarHistorialPorMaterial);
router.get('/historial/next/:codigo', volumetricosController.obtenerNextHistorial);
router.put('/historial/:codigo/:consecutivo', volumetricosController.actualizarHistorial);

// Intervalo routes
router.post('/intervalo', volumetricosController.crearIntervalo);
router.get('/intervalo/list/:codigo', volumetricosController.listarIntervaloPorMaterial);
router.get('/intervalo/next/:codigo', volumetricosController.obtenerNextIntervalo);
router.put('/intervalo/:codigo/:consecutivo', volumetricosController.actualizarIntervalo);

// PDFs: listar / subir / descargar / eliminar
router.get('/pdfs/:codigo', volumetricosController.listarPdfsPorMaterial);
const upload = require('../middleware/upload');
router.post('/pdfs/:codigo', upload.single('file'), volumetricosController.subirPdfMaterial);
router.get('/pdfs/download/:id', volumetricosController.descargarPdf);
router.delete('/pdfs/:id', volumetricosController.eliminarPdf);

module.exports = router;
