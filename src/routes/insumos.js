const express = require('express');
const router = express.Router();
const uploadImage = require('../middleware/uploadImage');
const insumosController = require('../controllers/insumosController');
const { verifyToken } = require('../middleware/jwt');
const { requireAuxEdit } = require('../middleware/auxPerm');

router.get('/', insumosController.getInsumos);
router.get('/:id/imagen', insumosController.getInsumoImagen);
router.get('/:id', insumosController.getInsumoById);
router.post('/', verifyToken, requireAuxEdit('insumos'), uploadImage.single('imagen'), insumosController.createInsumo);
router.post('/:id/imagen', verifyToken, requireAuxEdit('insumos'), uploadImage.single('imagen'), insumosController.updateInsumoImagen);
router.put('/:id', verifyToken, requireAuxEdit('insumos'), uploadImage.single('imagen'), insumosController.updateInsumo);
router.patch('/:id', verifyToken, requireAuxEdit('insumos'), uploadImage.single('imagen'), insumosController.updateInsumo);
router.delete('/:id', verifyToken, requireAuxEdit('insumos'), insumosController.deleteInsumo);

module.exports = router;
