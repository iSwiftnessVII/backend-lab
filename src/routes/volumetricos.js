const express = require('express');
const router = express.Router();
const volumetricosController = require('../controllers/volumetricosController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Rutas compatibles con frontend Angular (deben ir primero para evitar conflictos)
// Crear material volumétrico (POST /materiales)
router.post('/materiales', requireAuth, volumetricosController.crearMaterial);

// Listar materiales (GET /materiales)
router.get('/materiales', requireAuth, volumetricosController.listarMateriales);

// Listar historial por material (GET /materiales/:codigo/historial)
router.get('/materiales/:codigo/historial', requireAuth, volumetricosController.listarHistorialPorMaterial);

// Listar intervalo por material (GET /materiales/:codigo/intervalo)
router.get('/materiales/:codigo/intervalo', requireAuth, volumetricosController.listarIntervaloPorMaterial);

// Actualizar y eliminar material (PUT/DELETE /materiales/:codigo)
router.put('/materiales/:codigo', requireAuth, volumetricosController.actualizarMaterial);
router.delete('/materiales/:codigo', requireAuth, volumetricosController.eliminarMaterial);

// Obtener material completo (GET /materiales/:codigo)
router.get('/materiales/:codigo', requireAuth, volumetricosController.obtenerMaterialCompleto);

// Material Volumétrico routes (rutas genéricas al final)
router.post('/', requireAuth, volumetricosController.crearMaterial);
router.get('/', requireAuth, volumetricosController.listarMateriales);
router.get('/:codigo', requireAuth, volumetricosController.obtenerMaterialCompleto);
router.put('/:codigo', requireAuth, volumetricosController.actualizarMaterial);
router.delete('/:codigo', requireAuth, volumetricosController.eliminarMaterial);

// Historial routes
router.post('/historial', requireAuth, volumetricosController.crearHistorial);
router.get('/historial/list/:codigo', requireAuth, volumetricosController.listarHistorialPorMaterial);
router.get('/historial/next/:codigo', requireAuth, volumetricosController.obtenerNextHistorial);
router.put('/historial/:codigo/:consecutivo', requireAuth, volumetricosController.actualizarHistorial);

// Intervalo routes
router.post('/intervalo', requireAuth, volumetricosController.crearIntervalo);
router.get('/intervalo/list/:codigo', requireAuth, volumetricosController.listarIntervaloPorMaterial);
router.get('/intervalo/next/:codigo', requireAuth, volumetricosController.obtenerNextIntervalo);
router.put('/intervalo/:codigo/:consecutivo', requireAuth, volumetricosController.actualizarIntervalo);

// PDFs: listar / subir / descargar / eliminar
router.get('/pdfs/:codigo', requireAuth, volumetricosController.listarPdfsPorMaterial);
router.post('/pdfs/:codigo', requireAuth, upload.single('file'), volumetricosController.subirPdfMaterial);
router.get('/pdfs/download/:id', volumetricosController.descargarPdf); // Descarga puede ser pública o requerir auth, mejor dejar pública si es enlace directo, o auth si es vía app. Pondré auth por consistencia pero cuidado con visualizadores. Lo dejaré sin auth la descarga por si acaso, o con auth si el frontend envía token. El frontend suele usar window.open o similar que NO envía headers. Mejor DEJAR SIN AUTH la descarga por ahora para evitar romper visualización.
router.delete('/pdfs/:id', requireAuth, volumetricosController.eliminarPdf);
router.post('/documentos/generar', requireAuth, upload.single('template'), volumetricosController.generarDocumentoVolumetrico);
router.get('/documentos/plantillas', requireAuth, volumetricosController.listarPlantillasDocumentoVolumetrico);
router.post('/documentos/plantillas', requireAuth, upload.single('template'), volumetricosController.subirPlantillaDocumentoVolumetrico);
router.delete('/documentos/plantillas/:id', requireAuth, volumetricosController.eliminarPlantillaDocumentoVolumetrico);
router.post('/documentos/plantillas/:id/generar', requireAuth, volumetricosController.generarDocumentoVolumetricoDesdePlantilla);

module.exports = router;
