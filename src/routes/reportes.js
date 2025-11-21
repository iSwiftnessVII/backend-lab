const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const { requireAuth } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(requireAuth);

// Endpoints de reportes
router.get('/inventario', reportesController.getInventario);
router.get('/entradas', reportesController.getEntradas);
router.get('/salidas', reportesController.getSalidas);
router.get('/vencimientos', reportesController.getVencimientos);

module.exports = router;