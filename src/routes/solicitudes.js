const express = require('express');
const router = express.Router();
const solicitudesController = require('../controllers/solicitudesController');
const { verifyToken } = require('../middleware/jwt');

// ---------- DEPARTAMENTOS Y CIUDADES ----------
router.get('/departamentos', solicitudesController.getDepartamentos);
router.get('/ciudades', solicitudesController.getCiudades);

// ---------- CLIENTES CRUD ----------
router.get('/clientes', solicitudesController.getClientes);
router.post('/clientes', verifyToken, solicitudesController.createCliente);
router.get('/clientes/:id', solicitudesController.getClienteById);
router.put('/clientes/:id', verifyToken, solicitudesController.updateCliente);
router.delete('/clientes/:id', verifyToken, solicitudesController.deleteCliente);

// ---------- SOLICITUDES CRUD ----------
router.get('/', solicitudesController.getSolicitudes);
router.post('/', verifyToken, solicitudesController.createSolicitud);
router.get('/:id', solicitudesController.getSolicitudById);
router.put('/:id', verifyToken, solicitudesController.updateSolicitud);
router.delete('/:id', verifyToken, solicitudesController.deleteSolicitud);

// Endpoints de detalle
router.get('/detalle/lista', solicitudesController.getSolicitudesDetalle);
router.get('/detalle/:id', solicitudesController.getSolicitudDetalleById);

// Encuesta
router.post('/encuestas', verifyToken, solicitudesController.createEncuesta);

// ---------- OFERTA ----------
router.post('/oferta', verifyToken, solicitudesController.createOrUpdateOferta);
router.put('/oferta/:id_solicitud', verifyToken, solicitudesController.createOrUpdateOferta);

// ---------- REVISIÓN DE OFERTA ----------
router.post('/revision', verifyToken, solicitudesController.createOrUpdateRevision);
router.put('/revision/:id_solicitud', verifyToken, solicitudesController.createOrUpdateRevision);

// ---------- SEGUIMIENTO ENCUESTA ----------
router.post('/seguimiento-encuesta', verifyToken, solicitudesController.createOrUpdateSeguimientoEncuesta);
router.put('/seguimiento-encuesta/:id_solicitud', verifyToken, solicitudesController.createOrUpdateSeguimientoEncuesta);

module.exports = router;