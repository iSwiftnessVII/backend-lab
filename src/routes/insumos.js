const express = require('express');
const router = express.Router();
const insumosController = require('../controllers/insumosController');
const upload = require('../middleware/upload');
const uploadImage = require('../middleware/uploadImage');
const { verifyToken } = require('../middleware/jwt');

// GET /api/insumos/aux
router.get('/aux', insumosController.getAux);

// ========== CATÁLOGO DE INSUMOS ==========

// GET /api/insumos/catalogo?q=&limit=&offset=
router.get('/catalogo', insumosController.getCatalogo);

// GET /api/insumos/catalogo/:item
router.get('/catalogo/:item', insumosController.getCatalogoItem);

// POST /api/insumos/catalogo (multipart con 'imagen') - CON AUTENTICACIÓN
router.post('/catalogo', verifyToken, uploadImage.single('imagen'), insumosController.createCatalogo);

// PUT /api/insumos/catalogo/:item (multipart opcional 'imagen') - CON AUTENTICACIÓN
router.put('/catalogo/:item', verifyToken, uploadImage.single('imagen'), insumosController.updateCatalogo);

// DELETE /api/insumos/catalogo/:item
router.delete('/catalogo/:item', verifyToken, insumosController.deleteCatalogo);

// GET imagen del catálogo
router.get('/catalogo/:item/imagen', insumosController.getCatalogoItemImagen);

// ========== INSUMOS (CRUD) ==========

// GET /api/insumos?q=&limit=
router.get('/', insumosController.getInsumos);

// GET /api/insumos/:id
router.get('/:id', insumosController.getInsumoById);

// POST /api/insumos - CON AUTENTICACIÓN
router.post('/', verifyToken, insumosController.createInsumo);

// PUT /api/insumos/:id - CON AUTENTICACIÓN
router.put('/:id', verifyToken, insumosController.updateInsumo);

// PATCH existencias: ajustar cantidad existente absoluta o por delta - CON AUTENTICACIÓN
router.patch('/:id/existencias', verifyToken, insumosController.ajustarExistencias);

// DELETE /api/insumos/:id - CON AUTENTICACIÓN
router.delete('/:id', verifyToken, insumosController.deleteInsumo);

module.exports = router;