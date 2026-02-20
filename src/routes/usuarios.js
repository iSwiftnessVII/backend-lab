
const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { verifyToken } = require('../middleware/jwt');

/* PATCH /api/usuarios/nombre/:id - Cambiar nombre de usuario */
router.patch('/nombre/:id', verifyToken, usuariosController.cambiarNombre);

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

/* GET /api/usuarios/permisos?ids=1,2 - Obtener permisos auxiliares por lote */
router.get('/permisos', verifyToken, usuariosController.getPermisosAuxiliaresBatch);

/* GET /api/usuarios/permisos/:id - Obtener permisos auxiliares */
router.get('/permisos/:id', verifyToken, usuariosController.getPermisosAuxiliares);

/* PATCH /api/usuarios/permisos/:id - Actualizar permisos auxiliares */
router.patch('/permisos/:id', verifyToken, usuariosController.setPermisosAuxiliares);

module.exports = router;
