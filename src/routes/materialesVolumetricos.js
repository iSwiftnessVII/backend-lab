const express = require('express');
const router = express.Router();
const materialesVolController = require('../controllers/materialesVolumetricosController');

// CRUD básicos para materiales volumétricos
router.get('/', materialesVolController.listar);
router.get('/:id', materialesVolController.obtener);
router.post('/', materialesVolController.crear);
router.put('/:id', materialesVolController.actualizar);
router.delete('/:id', materialesVolController.eliminar);

module.exports = router;
