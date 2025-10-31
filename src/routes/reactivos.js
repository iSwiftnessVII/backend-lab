const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const reactivosController = require('../controllers/reactivosController');
const { verifyToken } = require('../middleware/jwt'); // Asegúrate de importar verifyToken

// GET /api/reactivos/aux
router.get('/aux', reactivosController.getAux);

// ========== CATÁLOGO DE REACTIVOS ==========

// GET /api/reactivos/catalogo?q=
router.get('/catalogo', reactivosController.getCatalogo);

// GET /api/reactivos/catalogo/:codigo
router.get('/catalogo/:codigo', reactivosController.getCatalogoItem);

// POST /api/reactivos/catalogo
router.post('/catalogo', reactivosController.createCatalogo);

// PUT /api/reactivos/catalogo/:codigo
router.put('/catalogo/:codigo', reactivosController.updateCatalogo);

// DELETE /api/reactivos/catalogo/:codigo - NUEVA RUTA QUE FALTABA
router.delete('/catalogo/:codigo', verifyToken, reactivosController.deleteCatalogo);

// ========== HOJA DE SEGURIDAD (PDFs) ==========

// GET availability
router.get('/catalogo/:codigo/hoja-seguridad', reactivosController.getHojaSeguridad);

// VIEW stream
router.get('/catalogo/:codigo/hoja-seguridad/view', reactivosController.viewHojaSeguridad);

// POST upload (CON MULTER)
router.post('/catalogo/:codigo/hoja-seguridad', upload.single('file'), reactivosController.uploadHojaSeguridad);

// DELETE - CON VERIFYTOKEN
router.delete('/catalogo/:codigo/hoja-seguridad', verifyToken, reactivosController.deleteHojaSeguridad);

// Por LOTE
router.get('/:lote/hoja-seguridad', reactivosController.getHojaSeguridadByLote);
router.get('/:lote/hoja-seguridad/view', reactivosController.viewHojaSeguridadByLote);
router.post('/:lote/hoja-seguridad', upload.single('file'), reactivosController.uploadHojaSeguridadByLote);
router.delete('/:lote/hoja-seguridad', verifyToken, reactivosController.deleteHojaSeguridadByLote);

// ========== CERTIFICADO DE ANÁLISIS (PDFs) ==========

// GET availability
router.get('/catalogo/:codigo/cert-analisis', reactivosController.getCertAnalisis);

// VIEW stream
router.get('/catalogo/:codigo/cert-analisis/view', reactivosController.viewCertAnalisis);

// POST upload (CON MULTER)
router.post('/catalogo/:codigo/cert-analisis', upload.single('file'), reactivosController.uploadCertAnalisis);

// DELETE - CON VERIFYTOKEN
router.delete('/catalogo/:codigo/cert-analisis', verifyToken, reactivosController.deleteCertAnalisis);

// Por LOTE
router.get('/:lote/cert-analisis', reactivosController.getCertAnalisisByLote);
router.get('/:lote/cert-analisis/view', reactivosController.viewCertAnalisisByLote);
router.post('/:lote/cert-analisis', upload.single('file'), reactivosController.uploadCertAnalisisByLote);
router.delete('/:lote/cert-analisis', verifyToken, reactivosController.deleteCertAnalisisByLote);

// ========== REACTIVOS (CRUD) ==========

// GET /api/reactivos?q=
router.get('/', reactivosController.getReactivos);

// GET /api/reactivos/:lote
router.get('/:lote', reactivosController.getReactivoByLote);

// POST /api/reactivos
router.post('/', reactivosController.createReactivo);

// PUT /api/reactivos/:lote
router.put('/:lote', reactivosController.updateReactivo);

// DELETE /api/reactivos/:lote - CON VERIFYTOKEN
router.delete('/:lote', verifyToken, reactivosController.deleteReactivo);

module.exports = router;