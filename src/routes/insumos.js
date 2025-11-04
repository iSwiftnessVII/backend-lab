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

// POST /api/insumos/catalogo (multipart con 'imagen')
router.post('/catalogo', uploadImage.single('imagen'), insumosController.createCatalogo);

// PUT /api/insumos/catalogo/:item (multipart opcional 'imagen')
router.put('/catalogo/:item', uploadImage.single('imagen'), insumosController.updateCatalogo);

// GET imagen del catálogo
router.get('/catalogo/:item/imagen', insumosController.getCatalogoItemImagen);

// ========== INSUMOS (CRUD) ==========

// GET /api/insumos?q=&limit=
router.get('/', insumosController.getInsumos);

// GET /api/insumos/:id
router.get('/:id', insumosController.getInsumoById);

// POST /api/insumos
router.post('/', insumosController.createInsumo);

// PUT /api/insumos/:id
router.put('/:id', insumosController.updateInsumo);

// DELETE /api/insumos/:id
router.delete('/:id', verifyToken, insumosController.deleteInsumo);

module.exports = router;