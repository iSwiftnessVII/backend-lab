const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const { verifyToken } = require('../middleware/jwt');

// Rutas de logs
router.get('/acciones', logsController.getLogs);
router.post('/acciones', verifyToken, logsController.crearLog);
router.get('/movimientos-inventario', logsController.getMovimientosInventario);
router.get('/estadisticas', logsController.getEstadisticasLogs);

module.exports = router;