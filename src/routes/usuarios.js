const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { verifyToken } = require('../middleware/jwt');

/* GET /api/usuarios/roles - Listar todos los roles */
router.get('/roles', verifyToken, usuariosController.getRoles);

/* GET /api/usuarios - Listar todos los usuarios */
router.get('/', verifyToken, usuariosController.getUsuarios);

/* POST /api/usuarios/crear - Crear nuevo usuario */
router.post('/crear', verifyToken, usuariosController.crearUsuario);

/* PATCH /api/usuarios/estado/:id - Cambiar estado (ACTIVO/INACTIVO) */
router.patch('/estado/:id', verifyToken, usuariosController.cambiarEstado);

/* DELETE /api/usuarios/eliminar/:id - Eliminar usuario */
router.delete('/eliminar/:id', verifyToken, usuariosController.eliminarUsuario);

/* PATCH /api/usuarios/rol/:id - Cambiar rol de usuario */
router.patch('/rol/:id', verifyToken, usuariosController.cambiarRol);

/* PATCH /api/usuarios/contrasena/:id - Cambiar contraseña de usuario */
router.patch('/contrasena/:id', verifyToken, usuariosController.cambiarContrasena);

module.exports = router;
