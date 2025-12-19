const express = require('express');
const router = express.Router();
const uploadImage = require('../middleware/uploadImage');
const papeleriaController = require('../controllers/papeleriaController');
const { verifyToken } = require('../middleware/jwt');

router.get('/', papeleriaController.getPapeleria);
router.get('/:id/imagen', papeleriaController.getPapeleriaImagen);
router.get('/:id', papeleriaController.getPapeleriaById);
router.post('/', verifyToken, uploadImage.single('imagen'), papeleriaController.createPapeleria);
router.put('/:id', verifyToken, uploadImage.single('imagen'), papeleriaController.updatePapeleria);
router.patch('/:id', verifyToken, uploadImage.single('imagen'), papeleriaController.updatePapeleria);
router.delete('/:id', verifyToken, papeleriaController.deletePapeleria);

module.exports = router;
