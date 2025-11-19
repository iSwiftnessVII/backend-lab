const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const reactivosController = require('../controllers/reactivosController');
const { verifyToken } = require('../middleware/jwt');

// GET /api/reactivos/aux
router.get('/aux', reactivosController.getAux);

// ========== CATÁLOGO DE REACTIVOS ==========

// GET /api/reactivos/catalogo?q=
router.get('/catalogo', reactivosController.getCatalogo);

// GET /api/reactivos/catalogo/:codigo
router.get('/catalogo/:codigo', reactivosController.getCatalogoItem);

// POST /api/reactivos/catalogo - CON AUTENTICACIÓN
router.post('/catalogo', verifyToken, reactivosController.createCatalogo);

// PUT /api/reactivos/catalogo/:codigo - CON AUTENTICACIÓN
router.put('/catalogo/:codigo', verifyToken, reactivosController.updateCatalogo);

// DELETE /api/reactivos/catalogo/:codigo - CON AUTENTICACIÓN
router.delete('/catalogo/:codigo', verifyToken, reactivosController.deleteCatalogo);

// ========== HOJA DE SEGURIDAD (PDFs) ==========

// GET availability
router.get('/catalogo/:codigo/hoja-seguridad', reactivosController.getHojaSeguridad);

// VIEW stream
router.get('/catalogo/:codigo/hoja-seguridad/view', reactivosController.viewHojaSeguridad);

// POST upload (CON MULTER) - CON AUTENTICACIÓN
router.post('/catalogo/:codigo/hoja-seguridad', verifyToken, upload.single('file'), reactivosController.uploadHojaSeguridad);

// DELETE - CON AUTENTICACIÓN
router.delete('/catalogo/:codigo/hoja-seguridad', verifyToken, reactivosController.deleteHojaSeguridad);

// Por LOTE
router.get('/:lote/hoja-seguridad', reactivosController.getHojaSeguridadByLote);
router.get('/:lote/hoja-seguridad/view', reactivosController.viewHojaSeguridadByLote);

// POST upload por lote - CON AUTENTICACIÓN
router.post('/:lote/hoja-seguridad', verifyToken, upload.single('file'), reactivosController.uploadHojaSeguridadByLote);

// DELETE por lote - CON AUTENTICACIÓN
router.delete('/:lote/hoja-seguridad', verifyToken, reactivosController.deleteHojaSeguridadByLote);

// ========== CERTIFICADO DE ANÁLISIS (PDFs) ==========

// GET availability
router.get('/catalogo/:codigo/cert-analisis', reactivosController.getCertAnalisis);

// VIEW stream
router.get('/catalogo/:codigo/cert-analisis/view', reactivosController.viewCertAnalisis);

// POST upload (CON MULTER) - CON AUTENTICACIÓN
router.post('/catalogo/:codigo/cert-analisis', verifyToken, upload.single('file'), reactivosController.uploadCertAnalisis);

// DELETE - CON AUTENTICACIÓN
router.delete('/catalogo/:codigo/cert-analisis', verifyToken, reactivosController.deleteCertAnalisis);

// Por LOTE
router.get('/:lote/cert-analisis', reactivosController.getCertAnalisisByLote);
router.get('/:lote/cert-analisis/view', reactivosController.viewCertAnalisisByLote);

// POST upload por lote - CON AUTENTICACIÓN
router.post('/:lote/cert-analisis', verifyToken, upload.single('file'), reactivosController.uploadCertAnalisisByLote);

// DELETE por lote - CON AUTENTICACIÓN
router.delete('/:lote/cert-analisis', verifyToken, reactivosController.deleteCertAnalisisByLote);

// ========== REACTIVOS (CRUD) ==========

// GET /api/reactivos?q=
router.get('/', reactivosController.getReactivos);
// GET /api/reactivos/export/excel
router.get('/export/excel', reactivosController.exportReactivosExcel);
// GET /api/reactivos/total
router.get('/total', reactivosController.getReactivosTotal);

// GET /api/reactivos/:lote
router.get('/:lote', reactivosController.getReactivoByLote);

// POST /api/reactivos - CON AUTENTICACIÓN
router.post('/', verifyToken, reactivosController.createReactivo);

// PUT /api/reactivos/:lote - CON AUTENTICACIÓN
router.put('/:lote', verifyToken, reactivosController.updateReactivo);

// DELETE /api/reactivos/:lote - CON AUTENTICACIÓN
router.delete('/:lote', verifyToken, reactivosController.deleteReactivo);

module.exports = router;