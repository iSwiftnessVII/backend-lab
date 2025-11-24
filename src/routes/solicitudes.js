const express = require('express');
const router = express.Router();
const solicitudesController = require('../controllers/solicitudesController');
// ---------- DEPARTAMENTOS Y CIUDADES ----------
router.get('/departamentos', solicitudesController.getDepartamentos);
router.get('/ciudades', solicitudesController.getCiudades);
const { verifyToken } = require('../middleware/jwt');

// ---------- CLIENTES CRUD ----------

// List clientes
router.get('/clientes', solicitudesController.getClientes);

// Create cliente - CON AUTENTICACIÓN
router.post('/clientes', verifyToken, solicitudesController.createCliente);

// Get single cliente
router.get('/clientes/:id', solicitudesController.getClienteById);

// Update cliente - CON AUTENTICACIÓN
router.put('/clientes/:id', verifyToken, solicitudesController.updateCliente);

// Delete cliente - CON AUTENTICACIÓN
router.delete('/clientes/:id', verifyToken, solicitudesController.deleteCliente);

// ---------- SOLICITUDES CRUD ----------

// List solicitudes
router.get('/', solicitudesController.getSolicitudes);

// Create solicitud - CON AUTENTICACIÓN
router.post('/', verifyToken, solicitudesController.createSolicitud);

// Get single solicitud
router.get('/:id', solicitudesController.getSolicitudById);

// Update solicitud - CON AUTENTICACIÓN
router.put('/:id', verifyToken, solicitudesController.updateSolicitud);

// Delete solicitud - CON AUTENTICACIÓN
router.delete('/:id', verifyToken, solicitudesController.deleteSolicitud);

// Create encuesta - CON AUTENTICACIÓN
router.post('/encuestas', verifyToken, solicitudesController.createEncuesta);

module.exports = router;