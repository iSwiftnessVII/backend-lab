const express = require('express');
const router = express.Router();
const equiposController = require('../controllers/equiposController');
const { verifyToken } = require('../middleware/jwt');

// GET /api/equipos?q=&limit=&offset=
router.get('/', equiposController.getEquipos);

// GET /api/equipos/:id
router.get('/:id', equiposController.getEquipoById);

// POST /api/equipos
router.post('/', equiposController.createEquipo);

// PUT /api/equipos/:id
router.put('/:id', equiposController.updateEquipo);

// DELETE /api/equipos/:id (protegido)
router.delete('/:id', verifyToken, equiposController.deleteEquipo);

module.exports = router;
