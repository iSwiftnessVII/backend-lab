const express = require('express');
const router = express.Router();
const referenciaController = require('../controllers/referenciaController');

// Material Referencia
router.get('/material', referenciaController.listarMateriales);
router.post('/material', referenciaController.crearMaterial);
router.put('/material/:codigo_id', referenciaController.actualizarMaterial);
router.delete('/material/:codigo_id', referenciaController.eliminarMaterial);

// Historial Referencia
router.get('/historial/:codigo_material', referenciaController.listarHistorialPorMaterial);
router.post('/historial', referenciaController.crearHistorial);
router.put('/historial/:codigo_material/:consecutivo', referenciaController.actualizarHistorial);
router.get('/historial/next/:codigo_material', referenciaController.obtenerNextHistorial);

// Intervalo Referencia
router.get('/intervalo/:codigo_material', referenciaController.listarIntervaloPorMaterial);
router.post('/intervalo', referenciaController.crearIntervalo);
router.put('/intervalo/:codigo_material/:consecutivo', referenciaController.actualizarIntervalo);
router.get('/intervalo/next/:codigo_material', referenciaController.obtenerNextIntervalo);

module.exports = router;