const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');

// Rutas de logs
router.get('/acciones', logsController.getLogs);
router.get('/movimientos-inventario', logsController.getMovimientosInventario);
router.get('/estadisticas', logsController.getEstadisticasLogs);

module.exports = router;