const express = require('express');
const router = express.Router();
const equiposController = require('../controllers/equiposController');
const { verifyToken } = require('../middleware/jwt');

// GET /api/equipos?q=&limit=&offset=
router.get('/', equiposController.getEquipos);

// GET /api/equipos/:id
router.get('/:id', equiposController.getEquipoById);

// POST /api/equipos
router.post('/', verifyToken, equiposController.createEquipo);

// PUT /api/equipos/:id
router.put('/:id', verifyToken, equiposController.updateEquipo);

// DELETE /api/equipos/:id (protegido)
router.delete('/:id', verifyToken, equiposController.deleteEquipo);

// POST /api/equipos/:id/mantenimientos
router.post('/:id/mantenimientos', verifyToken, equiposController.createMantenimientoEquipo);

// GET /api/equipos/:id/mantenimientos (listar mantenimientos del equipo)
router.get('/:id/mantenimientos', equiposController.getMantenimientosEquipo);

// POST /api/equipos/:id/verificaciones (verificación/calibración/calificación)
router.post('/:id/verificaciones', verifyToken, equiposController.createVcc);

// GET /api/equipos/:id/verificaciones
router.get('/:id/verificaciones', equiposController.getVcc);

// POST /api/equipos/:id/historial (historial instrumento)
router.post('/:id/historial', verifyToken, equiposController.createHistorialEquipo);

// GET /api/equipos/:id/historial
router.get('/:id/historial', equiposController.getHistorialEquipo);

// GET /api/equipos/:id/intervalos (listar intervalos de calibración del equipo)
router.get('/:id/intervalos', verifyToken, equiposController.getIntervalosEquipo);

// POST /api/equipos/:id/intervalos (crear intervalo de calibración)
router.post('/:id/intervalos', verifyToken, equiposController.createIntervaloEquipo);

module.exports = router;
