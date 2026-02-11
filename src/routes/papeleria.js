const express = require('express');
const router = express.Router();
const uploadImage = require('../middleware/uploadImage');
const papeleriaController = require('../controllers/papeleriaController');
const { verifyToken } = require('../middleware/jwt');
const { requireAuxEdit } = require('../middleware/auxPerm');

router.get('/', papeleriaController.getPapeleria);
router.get('/:id/imagen', papeleriaController.getPapeleriaImagen);
router.get('/:id', papeleriaController.getPapeleriaById);
router.post('/', verifyToken, requireAuxEdit('papeleria'), uploadImage.single('imagen'), papeleriaController.createPapeleria);
router.put('/:id', verifyToken, requireAuxEdit('papeleria'), uploadImage.single('imagen'), papeleriaController.updatePapeleria);
router.patch('/:id', verifyToken, requireAuxEdit('papeleria'), uploadImage.single('imagen'), papeleriaController.updatePapeleria);
router.delete('/:id', verifyToken, requireAuxEdit('papeleria'), papeleriaController.deletePapeleria);

module.exports = router;
