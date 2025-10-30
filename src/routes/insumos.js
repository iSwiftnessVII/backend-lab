const express = require('express');
const router = express.Router();
const insumosController = require('../controllers/insumosController');

// GET /api/insumos/aux
router.get('/aux', insumosController.getAux);

// ========== CATÁLOGO DE INSUMOS ==========

// GET /api/insumos/catalogo?q=&limit=&offset=
router.get('/catalogo', insumosController.getCatalogo);

// GET /api/insumos/catalogo/:item
router.get('/catalogo/:item', insumosController.getCatalogoItem);

// POST /api/insumos/catalogo
router.post('/catalogo', insumosController.createCatalogo);

// PUT /api/insumos/catalogo/:item
router.put('/catalogo/:item', insumosController.updateCatalogo);

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
router.delete('/:id', insumosController.deleteInsumo);

module.exports = router;