const express = require('express');
const router = express.Router();
const equiposController = require('../controllers/equiposController');

// POST /api/equipos/intervalo - Registrar intervalo de equipo
router.post('/intervalo', equiposController.crearIntervalo);

// POST /api/equipos - Registrar un nuevo equipo
router.post('/', equiposController.crearEquipo);

// POST /api/equipos/historial - Registrar historial de equipo
router.post('/historial', equiposController.crearHistorial);

// POST /api/equipos/ficha-tecnica - Registrar ficha técnica
router.post('/ficha-tecnica', equiposController.crearFichaTecnica);

// GET /api/equipos - Listar equipos registrados
router.get('/', equiposController.listarEquipos);

// ✅ NUEVA RUTA: Obtener equipo completo por código
router.get('/completo/:codigo', equiposController.obtenerEquipoCompleto);

// ✅ AGREGAR ESTA RUTA DESPUÉS DE LAS EXISTENTES
router.get('/fichas-tecnicas', equiposController.obtenerFichasTecnicas);

module.exports = router;