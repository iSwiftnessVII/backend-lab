const express = require('express');
const router = express.Router();
const solicitudesController = require('../controllers/solicitudesController');
const { verifyToken } = require('../middleware/jwt');

// ---------- CLIENTES CRUD ----------

// List clientes
router.get('/clientes', solicitudesController.getClientes);

// Create cliente
router.post('/clientes', solicitudesController.createCliente);

// Get single cliente
router.get('/clientes/:id', solicitudesController.getClienteById);

// Update cliente
router.put('/clientes/:id', solicitudesController.updateCliente);

// Delete cliente
router.delete('/clientes/:id', verifyToken, solicitudesController.deleteCliente);

// ---------- SOLICITUDES CRUD ----------

// List solicitudes
router.get('/', solicitudesController.getSolicitudes);

// Create solicitud
router.post('/', solicitudesController.createSolicitud);

// Get single solicitud
router.get('/:id', solicitudesController.getSolicitudById);

// Update solicitud
router.put('/:id', solicitudesController.updateSolicitud);

// Delete solicitud
router.delete('/:id', verifyToken, solicitudesController.deleteSolicitud);

// Create encuesta
router.post('/encuestas', solicitudesController.createEncuesta);

module.exports = router;