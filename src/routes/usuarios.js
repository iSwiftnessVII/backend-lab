const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');

/* GET /api/usuarios/roles - Listar todos los roles */
router.get('/roles', usuariosController.getRoles);

/* GET /api/usuarios - Listar todos los usuarios */
router.get('/', usuariosController.getUsuarios);

/* POST /api/usuarios/crear - Crear nuevo usuario */
router.post('/crear', usuariosController.crearUsuario);

/* PATCH /api/usuarios/estado/:id - Cambiar estado (ACTIVO/INACTIVO) */
router.patch('/estado/:id', usuariosController.cambiarEstado);

/* DELETE /api/usuarios/eliminar/:id - Eliminar usuario */
router.delete('/eliminar/:id', usuariosController.eliminarUsuario);

module.exports = router;