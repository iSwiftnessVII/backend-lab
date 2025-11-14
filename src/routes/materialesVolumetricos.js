const express = require('express');
const router = express.Router();
const materialesVolController = require('../controllers/materialesVolumetricosController');
const { verifyToken } = require('../middleware/jwt');

// CRUD básicos para materiales volumétricos
router.get('/', materialesVolController.listar);
router.get('/:id', materialesVolController.obtener);
router.post('/', verifyToken, materialesVolController.crear);
router.put('/:id', verifyToken, materialesVolController.actualizar);
router.delete('/:id', verifyToken, materialesVolController.eliminar);

module.exports = router;