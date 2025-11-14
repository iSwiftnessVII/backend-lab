const express = require('express');
const router = express.Router();
const papeleriaController = require('../controllers/papeleriaController');
const uploadImage = require('../middleware/uploadImage');
const { verifyToken } = require('../middleware/jwt');

// Catálogo de papelería
router.get('/catalogo', papeleriaController.getCatalogo);
router.get('/catalogo/:item', papeleriaController.getCatalogoItem);
router.get('/catalogo/:item/imagen', papeleriaController.getCatalogoItemImagen);
router.post('/catalogo', verifyToken, uploadImage.single('imagen'), papeleriaController.createCatalogo);
router.delete('/catalogo/:item', verifyToken, papeleriaController.deleteCatalogo);

// Inventario de papelería
router.get('/', papeleriaController.getPapeleria);
router.get('/:id', papeleriaController.getPapeleriaById);
router.post('/', verifyToken, papeleriaController.createPapeleria);
router.put('/:id', verifyToken, papeleriaController.updatePapeleria);
router.patch('/:id/existencias', verifyToken, papeleriaController.ajustarExistencias);
router.delete('/:id', verifyToken, papeleriaController.deletePapeleria);

module.exports = router;