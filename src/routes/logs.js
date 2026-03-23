const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const { verifyToken } = require('../middleware/jwt');
const { requireAdminAccess } = require('../middleware/auxPerm');

// Rutas de logs
router.get('/acciones', verifyToken, requireAdminAccess('auditoria'), logsController.getLogs);
router.post('/acciones', verifyToken, logsController.crearLog);
router.get('/movimientos-inventario', verifyToken, requireAdminAccess('auditoria'), logsController.getMovimientosInventario);
router.get('/estadisticas', verifyToken, requireAdminAccess('auditoria'), logsController.getEstadisticasLogs);

module.exports = router;
