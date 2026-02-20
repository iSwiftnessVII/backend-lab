const express = require('express');
const router = express.Router();
const solicitudesController = require('../controllers/solicitudesController');
const upload = require('../middleware/upload');
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
router.get('/documentos/plantillas', verifyToken, solicitudesController.listarPlantillasDocumentoSolicitud);
router.post('/documentos/plantillas', verifyToken, upload.single('template'), solicitudesController.subirPlantillaDocumentoSolicitud);
router.delete('/documentos/plantillas/:id', verifyToken, solicitudesController.eliminarPlantillaDocumentoSolicitud);
router.post('/documentos/plantillas/:id/generar', verifyToken, solicitudesController.generarDocumentoDesdePlantilla);

// ---------- SOLICITUDES CRUD ----------
router.get('/estados', verifyToken, solicitudesController.getEstadosSolicitud);
router.get('/', verifyToken, solicitudesController.getSolicitudes);
router.post('/', verifyToken, solicitudesController.createSolicitud);
router.get('/:id', verifyToken, solicitudesController.getSolicitudById);
router.put('/:id', verifyToken, solicitudesController.updateSolicitud);
router.delete('/:id', verifyToken, solicitudesController.deleteSolicitud);
router.patch('/:id/estado', verifyToken, solicitudesController.updateSolicitudEstado);
router.patch('/:id/asignacion', verifyToken, solicitudesController.updateSolicitudAsignacion);

// Endpoints de detalle
router.get('/detalle/lista', verifyToken, solicitudesController.getSolicitudesDetalle);
router.get('/detalle/:id', verifyToken, solicitudesController.getSolicitudDetalleById);

// Encuesta
router.post('/encuestas', verifyToken, solicitudesController.createEncuesta);

// ---------- OFERTA ----------
router.post('/oferta', verifyToken, solicitudesController.createOrUpdateOferta);
router.put('/oferta/:id_solicitud', verifyToken, solicitudesController.createOrUpdateOferta);

// ---------- REVISIÓN DE OFERTA ----------
router.post('/revision', verifyToken, solicitudesController.createOrUpdateRevision);
router.put('/revision/:id_solicitud', verifyToken, solicitudesController.createOrUpdateRevision);

// Suscripciones para nuevas solicitudes
router.post('/suscripciones-solicitudes', verifyToken, solicitudesController.suscribirseSolicitudes);
router.get('/suscripciones-solicitudes/:email', verifyToken, solicitudesController.obtenerEstadoSuscripcionSolicitudes);
router.delete('/suscripciones-solicitudes/:email', verifyToken, solicitudesController.cancelarSuscripcionSolicitudes);

// Suscripciones para revisión de oferta
router.post('/suscripciones-revision', verifyToken, solicitudesController.suscribirseRevisionOferta);
router.get('/suscripciones-revision/:email', verifyToken, solicitudesController.obtenerEstadoSuscripcionRevisionOferta);
router.delete('/suscripciones-revision/:email', verifyToken, solicitudesController.cancelarSuscripcionRevisionOferta);

// ---------- SEGUIMIENTO ENCUESTA ----------
router.post('/seguimiento-encuesta', verifyToken, solicitudesController.createOrUpdateSeguimientoEncuesta);
router.put('/seguimiento-encuesta/:id_solicitud', verifyToken, solicitudesController.createOrUpdateSeguimientoEncuesta);

module.exports = router;
