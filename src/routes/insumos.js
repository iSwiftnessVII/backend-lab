const express = require('express');
const router = express.Router();
const uploadImage = require('../middleware/uploadImage');
const insumosController = require('../controllers/insumosController');
const { verifyToken } = require('../middleware/jwt');

router.get('/', insumosController.getInsumos);
router.get('/:id', insumosController.getInsumoById);
router.post('/', verifyToken, uploadImage.single('imagen'), insumosController.createInsumo);
router.put('/:id', verifyToken, uploadImage.single('imagen'), insumosController.updateInsumo);
router.patch('/:id', verifyToken, uploadImage.single('imagen'), insumosController.updateInsumo);
router.delete('/:id', verifyToken, insumosController.deleteInsumo);

module.exports = router;

