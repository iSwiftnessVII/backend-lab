const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const reactivosController = require('../controllers/reactivosController');

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

// ========== HOJA DE SEGURIDAD (PDFs) ==========

// GET availability
router.get('/catalogo/:codigo/hoja-seguridad', reactivosController.getHojaSeguridad);

// VIEW stream
router.get('/catalogo/:codigo/hoja-seguridad/view', reactivosController.viewHojaSeguridad);

// POST upload (CON MULTER)
router.post('/catalogo/:codigo/hoja-seguridad', upload.single('file'), reactivosController.uploadHojaSeguridad);

// DELETE
router.delete('/catalogo/:codigo/hoja-seguridad', reactivosController.deleteHojaSeguridad);

// ========== CERTIFICADO DE ANÁLISIS (PDFs) ==========

// GET availability
router.get('/catalogo/:codigo/cert-analisis', reactivosController.getCertAnalisis);

// VIEW stream
router.get('/catalogo/:codigo/cert-analisis/view', reactivosController.viewCertAnalisis);

// POST upload (CON MULTER)
router.post('/catalogo/:codigo/cert-analisis', upload.single('file'), reactivosController.uploadCertAnalisis);

// DELETE
router.delete('/catalogo/:codigo/cert-analisis', reactivosController.deleteCertAnalisis);

// ========== REACTIVOS (CRUD) ==========

// GET /api/reactivos?q=
router.get('/', reactivosController.getReactivos);

// GET /api/reactivos/:lote
router.get('/:lote', reactivosController.getReactivoByLote);

// POST /api/reactivos
router.post('/', reactivosController.createReactivo);

// PUT /api/reactivos/:lote
router.put('/:lote', reactivosController.updateReactivo);

// DELETE /api/reactivos/:lote
router.delete('/:lote', reactivosController.deleteReactivo);

module.exports = router;