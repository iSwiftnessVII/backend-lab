const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const reactivosController = require('../controllers/reactivosController');
const { verifyToken } = require('../middleware/jwt');
const { requireAuxEdit } = require('../middleware/auxPerm');

// GET /api/reactivos/aux
router.get('/aux', reactivosController.getAux);

// ========== CATÁLOGO DE REACTIVOS ==========

// GET /api/reactivos/catalogo?q=
router.get('/catalogo', reactivosController.getCatalogo);

// GET /api/reactivos/catalogo/:codigo
router.get('/catalogo/:codigo', reactivosController.getCatalogoItem);

// POST /api/reactivos/catalogo - CON AUTENTICACIÓN
router.post('/catalogo', verifyToken, requireAuxEdit('reactivos'), reactivosController.createCatalogo);

// PUT /api/reactivos/catalogo/:codigo - CON AUTENTICACIÓN
router.put('/catalogo/:codigo', verifyToken, requireAuxEdit('reactivos'), reactivosController.updateCatalogo);

// DELETE /api/reactivos/catalogo/:codigo - CON AUTENTICACIÓN
router.delete('/catalogo/:codigo', verifyToken, requireAuxEdit('reactivos'), reactivosController.deleteCatalogo);

// ========== HOJA DE SEGURIDAD (PDFs) ==========

// GET availability
router.get('/catalogo/:codigo/hoja-seguridad', reactivosController.getHojaSeguridad);

// VIEW stream
router.get('/catalogo/:codigo/hoja-seguridad/view', reactivosController.viewHojaSeguridad);

// POST upload (CON MULTER) - CON AUTENTICACIÓN
router.post('/catalogo/:codigo/hoja-seguridad', verifyToken, requireAuxEdit('reactivos'), upload.single('file'), reactivosController.uploadHojaSeguridad);

// DELETE - CON AUTENTICACIÓN
router.delete('/catalogo/:codigo/hoja-seguridad', verifyToken, requireAuxEdit('reactivos'), reactivosController.deleteHojaSeguridad);

// Por LOTE
router.get('/:lote/hoja-seguridad', reactivosController.getHojaSeguridadByLote);
router.get('/:lote/hoja-seguridad/view', reactivosController.viewHojaSeguridadByLote);

// POST upload por lote - CON AUTENTICACIÓN
router.post('/:lote/hoja-seguridad', verifyToken, requireAuxEdit('reactivos'), upload.single('file'), reactivosController.uploadHojaSeguridadByLote);

// DELETE por lote - CON AUTENTICACIÓN
router.delete('/:lote/hoja-seguridad', verifyToken, requireAuxEdit('reactivos'), reactivosController.deleteHojaSeguridadByLote);

// ========== CERTIFICADO DE ANÁLISIS (PDFs) ==========

// GET availability
router.get('/catalogo/:codigo/cert-analisis', reactivosController.getCertAnalisis);

// VIEW stream
router.get('/catalogo/:codigo/cert-analisis/view', reactivosController.viewCertAnalisis);

// POST upload (CON MULTER) - CON AUTENTICACIÓN
router.post('/catalogo/:codigo/cert-analisis', verifyToken, requireAuxEdit('reactivos'), upload.single('file'), reactivosController.uploadCertAnalisis);

// DELETE - CON AUTENTICACIÓN
router.delete('/catalogo/:codigo/cert-analisis', verifyToken, requireAuxEdit('reactivos'), reactivosController.deleteCertAnalisis);

// Por LOTE
router.get('/:lote/cert-analisis', reactivosController.getCertAnalisisByLote);
router.get('/:lote/cert-analisis/view', reactivosController.viewCertAnalisisByLote);

// POST upload por lote - CON AUTENTICACIÓN
router.post('/:lote/cert-analisis', verifyToken, requireAuxEdit('reactivos'), upload.single('file'), reactivosController.uploadCertAnalisisByLote);

// DELETE por lote - CON AUTENTICACIÓN
router.delete('/:lote/cert-analisis', verifyToken, requireAuxEdit('reactivos'), reactivosController.deleteCertAnalisisByLote);

// ========== SUSCRIPCIONES Y NOTIFICACIONES ==========
// Suscribirse a notificaciones de vencimiento de reactivos
router.post('/suscripciones', reactivosController.suscribirseReactivos);
// Obtener estado de suscripción por email
router.get('/suscripciones/:email', reactivosController.obtenerEstadoSuscripcion);
// Cancelar suscripción por email
router.delete('/suscripciones/:email', reactivosController.cancelarSuscripcion);
// Enviar notificación de prueba
router.post('/notificaciones/test', reactivosController.enviarNotificacionPrueba);

// Listar alertas próximas (6, 3, 2, 1 meses)
router.get('/alertas-proximas', reactivosController.listarAlertasProximas);

// ========== GENERACIÓN DE DOCUMENTOS ==========
router.get('/documentos/plantillas', verifyToken, reactivosController.listarPlantillasDocumentoReactivo);
router.post('/documentos/plantillas', verifyToken, requireAuxEdit('reactivos'), upload.single('template'), reactivosController.subirPlantillaDocumentoReactivo);
router.delete('/documentos/plantillas/:id', verifyToken, requireAuxEdit('reactivos'), reactivosController.eliminarPlantillaDocumentoReactivo);
router.post('/documentos/plantillas/:id/generar', verifyToken, requireAuxEdit('reactivos'), reactivosController.generarDocumentoReactivoDesdePlantilla);

// ========== REACTIVOS (CRUD) ==========

// GET /api/reactivos?q=
router.get('/', reactivosController.getReactivos);
// GET /api/reactivos/export/excel
router.get('/export/excel', reactivosController.exportReactivosExcel);
// GET /api/reactivos/total
router.get('/total', reactivosController.getReactivosTotal);

// GET /api/reactivos/consumo - CON AUTENTICACIÓN
router.get('/consumo', verifyToken, reactivosController.listarConsumosReactivos);

// POST /api/reactivos/consumo - CON AUTENTICACIÓN
router.post('/consumo', verifyToken, requireAuxEdit('reactivos'), reactivosController.registrarConsumo);

// GET /api/reactivos/:lote
router.get('/:lote', reactivosController.getReactivoByLote);

// POST /api/reactivos - CON AUTENTICACIÓN
router.post('/', verifyToken, requireAuxEdit('reactivos'), reactivosController.createReactivo);

// PUT /api/reactivos/:lote - CON AUTENTICACIÓN
router.put('/:lote', verifyToken, requireAuxEdit('reactivos'), reactivosController.updateReactivo);

// DELETE /api/reactivos/:lote - CON AUTENTICACIÓN
router.delete('/:lote', verifyToken, requireAuxEdit('reactivos'), reactivosController.deleteReactivo);

module.exports = router;
