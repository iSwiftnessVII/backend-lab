const express = require('express');
const router = express.Router();
const volumetricosController = require('../controllers/volumetricosController');

// Rutas compatibles con frontend Angular (deben ir primero para evitar conflictos)
// Crear material volumétrico (POST /materiales)
router.post('/materiales', volumetricosController.crearMaterial);

// Listar materiales (GET /materiales)
router.get('/materiales', volumetricosController.listarMateriales);

// Listar historial por material (GET /materiales/:codigo/historial)
router.get('/materiales/:codigo/historial', volumetricosController.listarHistorialPorMaterial);

// Listar intervalo por material (GET /materiales/:codigo/intervalo)
router.get('/materiales/:codigo/intervalo', volumetricosController.listarIntervaloPorMaterial);

// Actualizar y eliminar material (PUT/DELETE /materiales/:codigo)
router.put('/materiales/:codigo', volumetricosController.actualizarMaterial);
router.delete('/materiales/:codigo', volumetricosController.eliminarMaterial);

// Obtener material completo (GET /materiales/:codigo)
router.get('/materiales/:codigo', volumetricosController.obtenerMaterialCompleto);

// Material Volumétrico routes (rutas genéricas al final)
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
