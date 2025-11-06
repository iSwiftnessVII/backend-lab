const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// GET /api/dashboard/metricas-principales
router.get('/metricas-principales', dashboardController.getMetricasPrincipales);

// GET /api/dashboard/reactivos-proximos-vencer  
router.get('/reactivos-proximos-vencer', dashboardController.getReactivosProximosVencer);

module.exports = router;