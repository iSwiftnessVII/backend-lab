const express = require('express');
const router = express.Router();
const equiposController = require('../controllers/equiposController');
const uploadImage = require('../middleware/uploadImage');

// POST /api/equipos/intervalo - Registrar intervalo de equipo
router.post('/intervalo', equiposController.crearIntervalo);

// POST /api/equipos - Registrar un nuevo equipo
router.post('/', equiposController.crearEquipo);

// POST /api/equipos/historial - Registrar historial de equipo
router.post('/historial', equiposController.crearHistorial);

// POST /api/equipos/ficha-tecnica - Registrar ficha técnica (con imagen de firma)
router.post('/ficha-tecnica', uploadImage.single('firma'), equiposController.crearFichaTecnica);

// GET /api/equipos - Listar equipos registrados
router.get('/', equiposController.listarEquipos);

// ✅ NUEVA RUTA: Obtener equipo completo por código
router.get('/completo/:codigo', equiposController.obtenerEquipoCompleto);

// ✅ AGREGAR ESTA RUTA DESPUÉS DE LAS EXISTENTES
router.get('/fichas-tecnicas', equiposController.obtenerFichasTecnicas);
// Firma de ficha técnica
router.get('/ficha-tecnica/firma/:codigo', equiposController.obtenerFirmaFicha);
// Alias más simple
router.get('/firma/:codigo', equiposController.obtenerFirmaFicha);

// Next consecutivo endpoints
router.get('/historial/next/:codigo', equiposController.obtenerNextHistorial);
router.get('/intervalo/next/:codigo', equiposController.obtenerNextIntervalo);

// List historial/intervalo by equipo
router.get('/historial/list/:codigo', equiposController.listarHistorialPorEquipo);
router.get('/intervalo/list/:codigo', equiposController.listarIntervaloPorEquipo);
// PUT /api/equipos/historial/:equipo/:consecutivo - Actualizar registro de historial por equipo+consecutivo
router.put('/historial/:equipo/:consecutivo', equiposController.actualizarHistorial);
// PUT /api/equipos/intervalo/:equipo/:consecutivo - Actualizar registro de intervalo por equipo+consecutivo
router.put('/intervalo/:equipo/:consecutivo', equiposController.actualizarIntervalo);

// DELETE /api/equipos/:codigo - Eliminar equipo (y dependencias)
router.delete('/:codigo', equiposController.eliminarEquipo);

// PDFs: listar / subir / descargar / eliminar
router.get('/pdfs/:codigo', equiposController.listarPdfsPorEquipo);
const upload = require('../middleware/upload');
router.post('/pdfs/:codigo', upload.single('file'), equiposController.subirPdfEquipo);
router.get('/pdfs/download/:id', equiposController.descargarPdf);
router.delete('/pdfs/:id', equiposController.eliminarPdf);

module.exports = router;