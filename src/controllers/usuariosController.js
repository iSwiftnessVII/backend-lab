const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { AUX_MODULES, ADMIN_MODULES } = require('../middleware/auxPerm');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { nodemailer = null; }

const SALT_ROUNDS = 10;
const AUX_MODULE_KEYS = Array.from(AUX_MODULES);
const ADMIN_MODULE_KEYS = Array.from(ADMIN_MODULES);

function getModuleKeysByRole(roleName) {
  if (roleName === 'Auxiliar') return AUX_MODULE_KEYS;
  if (roleName === 'Administrador') return ADMIN_MODULE_KEYS;
  return [];
}

const usuariosController = {

    /* PATCH /api/usuarios/nombre/:id - Cambiar nombre de usuario */
    cambiarNombre: async (req, res) => {
      const { id } = req.params;
      const { nombre } = req.body || {};
      if (!nombre || typeof nombre !== 'string' || !nombre.trim() || nombre.length > 150) {
        return res.status(400).json({ message: 'Nombre es requerido y debe tener máximo 150 caracteres' });
      }
      try {
        const [userCheck] = await pool.query('SELECT id_usuario FROM usuarios WHERE id_usuario = ?', [id]);
        if (!userCheck.length) {
          return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        await pool.query('UPDATE usuarios SET nombre = ? WHERE id_usuario = ?', [nombre.trim(), id]);
        res.json({ message: 'Nombre actualizado correctamente' });
      } catch (err) {
        console.error('Error PATCH /nombre/:id:', err);
        res.status(500).json({ message: 'Error actualizando nombre' });
      }
    },
  /* GET /api/usuarios/roles - Listar todos los roles */
  getRoles: async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM roles ORDER BY nombre');
      res.json(rows);
    } catch (err) {
      console.error('Error GET /roles:', err);
      res.status(500).json({ message: 'Error listando roles' });
    }
  },

  /* GET /api/usuarios - Listar todos los usuarios */
  getUsuarios: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          u.id_usuario,
          u.email,
          u.nombre,
          u.rol_id,
          u.estado,
          u.created_at,
          r.nombre as rol_nombre
        FROM usuarios u
        LEFT JOIN roles r ON u.rol_id = r.id_rol
        ORDER BY u.created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error('Error GET /usuarios:', err);
      res.status(500).json({ message: 'Error listando usuarios' });
    }
  },

  /* POST /api/usuarios/crear - Crear nuevo usuario */
  crearUsuario: async (req, res) => {

    const { email, nombre, contrasena, rol_id } = req.body || {};

    // Validaciones
    if (!email || !nombre || !contrasena || !rol_id) {
      return res.status(400).json({
        message: 'Email, nombre, contraseña y rol son requeridos'
      });
    }

    if (contrasena.length < 6) {
      return res.status(400).json({
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Email no válido' });
    }

    if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 150) {
      return res.status(400).json({ message: 'Nombre es requerido y debe tener máximo 150 caracteres' });
    }

    try {
      // Verificar si el email ya existe
      const [existing] = await pool.query(
        'SELECT id_usuario FROM usuarios WHERE email = ?',
        [email.toLowerCase().trim()]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          message: 'El email ya está registrado'
        });
      }

      // Verificar que el rol existe
      const [roleCheck] = await pool.query(
        'SELECT id_rol FROM roles WHERE id_rol = ?',
        [rol_id]
      );

      if (!roleCheck.length) {
        return res.status(400).json({ message: 'Rol no válido' });
      }

      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(contrasena, SALT_ROUNDS);

      // Insertar usuario
      const [result] = await pool.query(
        'INSERT INTO usuarios (email, nombre, contrasena, rol_id, estado) VALUES (?, ?, ?, ?, ?)',
        [email.toLowerCase().trim(), nombre.trim(), hashedPassword, rol_id, 'ACTIVO']
      );

      // Log auditoría
      if (req.user && req.user.id) {
         const fecha = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Bogota',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
         }).format(new Date());

         await pool.query(
            'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'CREAR', 'USUARIOS', fecha, `Creación de usuario: ${email.toLowerCase().trim()}`]
         );
      }

      res.status(201).json({
        message: 'Usuario creado correctamente',
        id_usuario: result.insertId,
        email: email.toLowerCase().trim(),
        nombre: nombre.trim(),
        rol_id
      });
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'El email ya está registrado' });
      }
      console.error('Error POST /crear:', err);
      res.status(500).json({ message: 'Error creando usuario' });
    }
  },

  /* PATCH /api/usuarios/estado/:id - Cambiar estado (ACTIVO/INACTIVO) */
  cambiarEstado: async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body || {};

    if (!estado || !['ACTIVO', 'INACTIVO'].includes(estado)) {
      return res.status(400).json({
        message: 'Estado debe ser "ACTIVO" o "INACTIVO"'
      });
    }

    try {
      const [rowsCurrent] = await pool.query(
        'SELECT id_usuario, estado FROM usuarios WHERE id_usuario = ?',
        [id]
      );

      if (!rowsCurrent.length) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      const datosActuales = rowsCurrent[0];

      await pool.query(
        'UPDATE usuarios SET estado = ? WHERE id_usuario = ?',
        [estado, id]
      );

      if (req.user && req.user.id) {
        const cambios = {};
        if (datosActuales.estado !== estado) {
             cambios.estado = { anterior: datosActuales.estado, nuevo: estado };
        }
        
        if (Object.keys(cambios).length > 0) {
             const fecha = new Intl.DateTimeFormat('sv-SE', {
                timeZone: 'America/Bogota',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
             }).format(new Date());

             await pool.query(
                'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, 'ACTUALIZAR', 'USUARIOS', fecha, `Cambio de estado usuario: ${id}`]
             );
        }
      }

      res.json({
        message: `Usuario ${estado === 'ACTIVO' ? 'activado' : 'desactivado'} correctamente`
      });
    } catch (err) {
      console.error('Error PATCH /estado/:id:', err);
      res.status(500).json({ message: 'Error cambiando estado' });
    }
  },

  /* DELETE /api/usuarios/eliminar/:id - Eliminar usuario */
  eliminarUsuario: async (req, res) => {
    const { id } = req.params;

    try {
      const [result] = await pool.query(
        'DELETE FROM usuarios WHERE id_usuario = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      if (req.user && req.user.id) {
         const fecha = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Bogota',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
         }).format(new Date());

         await pool.query(
            'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'ELIMINAR', 'USUARIOS', fecha, `Eliminación de usuario: ${id}`]
         );
      }

      res.json({ message: 'Usuario eliminado correctamente' });
    } catch (err) {
      console.error('Error DELETE /eliminar/:id:', err);

      // Manejar error de foreign key constraint
      if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({
          message: 'No se puede eliminar: el usuario tiene registros asociados'
        });
      }

      res.status(500).json({ message: 'Error eliminando usuario' });
    }
  },

  /* PATCH /api/usuarios/rol/:id - Cambiar rol de usuario */
  cambiarRol: async (req, res) => {
    const { id } = req.params;
    const { rol_id } = req.body || {};

    // VERIFICACIÓN POR ROL - Solo Superadmin puede cambiar roles
    if (req.user.rol !== 'Superadmin') {
      return res.status(403).json({
        message: 'No tienes permisos para cambiar roles. Solo el Superadmin puede realizar esta acción.'
      });
    }

    // Validaciones
    if (!rol_id) {
      return res.status(400).json({
        message: 'El rol_id es requerido'
      });
    }

    try {
      // Verificar que el usuario existe
      const [userCheck] = await pool.query(
        'SELECT id_usuario FROM usuarios WHERE id_usuario = ?',
        [id]
      );

      if (!userCheck.length) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Verificar que el rol existe
      const [roleCheck] = await pool.query(
        'SELECT id_rol, nombre FROM roles WHERE id_rol = ?',
        [rol_id]
      );

      if (!roleCheck.length) {
        return res.status(400).json({ message: 'Rol no válido' });
      }
      const nuevoRolNombre = roleCheck[0].nombre;

      // Obtener datos actuales del usuario para el log
      const [rowsCurrent] = await pool.query(
        'SELECT u.id_usuario, u.rol_id, r.nombre as rol_nombre FROM usuarios u LEFT JOIN roles r ON u.rol_id = r.id_rol WHERE u.id_usuario = ?',
        [id]
      );
      
      const datosActuales = rowsCurrent[0];

      // Actualizar el rol del usuario
      await pool.query(
        'UPDATE usuarios SET rol_id = ? WHERE id_usuario = ?',
        [rol_id, id]
      );

      if (req.user && req.user.id) {
          const cambios = {};
          if (datosActuales.rol_id != rol_id) {
               cambios.rol = { 
                 anterior: datosActuales.rol_nombre || datosActuales.rol_id, 
                 nuevo: nuevoRolNombre || rol_id 
               };
          }

          if (Object.keys(cambios).length > 0) {
               const fecha = new Intl.DateTimeFormat('sv-SE', {
                  timeZone: 'America/Bogota',
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
               }).format(new Date());

               await pool.query(
                  'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
                  [req.user.id, 'ACTUALIZAR', 'USUARIOS', fecha, `Cambio de rol usuario: ${id}`]
               );
          }
      }

      res.json({
        message: 'Rol actualizado correctamente',
        id_usuario: parseInt(id),
        nuevo_rol_id: parseInt(rol_id)
      });
    } catch (err) {
      console.error('Error PATCH /rol/:id:', err);
      res.status(500).json({ message: 'Error cambiando rol' });
    }
  },
  
  cambiarContrasena: async (req, res) => {
    const { id } = req.params;
    const { contrasena } = req.body || {};
    
    if (req.user.rol !== 'Superadmin') {
      return res.status(403).json({ message: 'No tienes permisos para cambiar contraseñas' });
    }
    if (!contrasena || typeof contrasena !== 'string' || contrasena.trim().length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    try {
      const [userCheck] = await pool.query(
        'SELECT id_usuario FROM usuarios WHERE id_usuario = ?',
        [id]
      );
      if (!userCheck.length) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      const hashed = await bcrypt.hash(contrasena.trim(), SALT_ROUNDS);
      
      await pool.query(
        'UPDATE usuarios SET contrasena = ? WHERE id_usuario = ?',
        [hashed, id]
      );

      if (req.user && req.user.id) {
         const fecha = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Bogota',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
         }).format(new Date());

         await pool.query(
            'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'ACTUALIZAR', 'USUARIOS', fecha, `Cambio de contraseña usuario: ${id}`]
         );
      }
      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
      console.error('Error PATCH /contrasena/:id:', err);
      res.status(500).json({ message: 'Error actualizando contraseña' });
    }
  },

  /* GET /api/usuarios/permisos/:id - Obtener permisos auxiliares por usuario */
  getPermisosAuxiliares: async (req, res) => {
    const { id } = req.params;

    if (req.user.rol !== 'Superadmin' && Number(req.user.id) !== Number(id)) {
      return res.status(403).json({ message: 'No tienes permisos para ver permisos de usuario' });
    }

    try {
      const [userCheck] = await pool.query(
        `SELECT u.id_usuario, r.nombre AS rol_nombre
         FROM usuarios u
         LEFT JOIN roles r ON r.id_rol = u.rol_id
         WHERE u.id_usuario = ?`,
        [id]
      );
      if (!userCheck.length) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const targetRole = userCheck[0].rol_nombre || '';
      const allowedKeys = getModuleKeysByRole(targetRole);
      if (!allowedKeys.length) {
        return res.json({ usuario_id: Number(id), permisos: {} });
      }

      const [rows] = await pool.query(
        'SELECT modulo, puede_editar FROM usuarios_permisos WHERE usuario_id = ? AND modulo IN (?)',
        [id, allowedKeys]
      );

      const permisos = {};
      for (const key of allowedKeys) permisos[key] = true;
      for (const row of rows) {
        permisos[row.modulo] = Number(row.puede_editar) === 1;
      }

      res.json({ usuario_id: Number(id), permisos });
    } catch (err) {
      console.error('Error GET /permisos/:id:', err);
      res.status(500).json({ message: 'Error obteniendo permisos de usuario' });
    }
  },

  /* GET /api/usuarios/permisos?ids=1,2,3 - Obtener permisos auxiliares por lote */
  getPermisosAuxiliaresBatch: async (req, res) => {
    if (req.user.rol !== 'Superadmin') {
      return res.status(403).json({ message: 'No tienes permisos para ver permisos de usuario' });
    }

    const idsParam = req.query.ids || '';
    const ids = String(idsParam)
      .split(',')
      .map((v) => parseInt(String(v).trim(), 10))
      .filter((v) => Number.isFinite(v));

    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length) {
      return res.status(400).json({ message: 'Ids inválidos' });
    }

    try {
      const [userRows] = await pool.query(
        `SELECT u.id_usuario, r.nombre AS rol_nombre
         FROM usuarios u
         LEFT JOIN roles r ON r.id_rol = u.rol_id
         WHERE u.id_usuario IN (?)`,
        [uniqueIds]
      );

      const userById = {};
      for (const row of userRows || []) {
        const uid = Number(row.id_usuario);
        if (!Number.isFinite(uid)) continue;
        userById[uid] = row.rol_nombre || '';
      }

      const validIds = Object.keys(userById).map((k) => Number(k)).filter((v) => Number.isFinite(v));
      if (!validIds.length) {
        return res.json({ rows: [] });
      }

      const allAllowedKeys = Array.from(new Set([...AUX_MODULE_KEYS, ...ADMIN_MODULE_KEYS]));
      const [rows] = await pool.query(
        'SELECT usuario_id, modulo, puede_editar FROM usuarios_permisos WHERE usuario_id IN (?) AND modulo IN (?)',
        [validIds, allAllowedKeys]
      );

      const map = {};
      for (const id of validIds) {
        const roleName = userById[id] || '';
        const keys = getModuleKeysByRole(roleName);
        map[id] = {};
        for (const key of keys) map[id][key] = true;
      }

      for (const row of rows || []) {
        const uid = Number(row.usuario_id);
        if (!map[uid]) continue;
        if (!Object.prototype.hasOwnProperty.call(map[uid], row.modulo)) continue;
        map[uid][row.modulo] = Number(row.puede_editar) === 1;
      }

      const payload = validIds.map((id) => ({ usuario_id: id, permisos: map[id] }));
      res.json({ rows: payload });
    } catch (err) {
      console.error('Error GET /permisos (batch):', err);
      res.status(500).json({ message: 'Error obteniendo permisos de usuario' });
    }
  },

  /* PATCH /api/usuarios/permisos/:id - Actualizar permisos auxiliares por usuario */
  setPermisosAuxiliares: async (req, res) => {
    const { id } = req.params;
    const { permisos } = req.body || {};

    if (req.user.rol !== 'Superadmin') {
      return res.status(403).json({ message: 'No tienes permisos para cambiar permisos de usuario' });
    }

    if (!permisos || typeof permisos !== 'object') {
      return res.status(400).json({ message: 'Permisos inválidos' });
    }

    try {
      const [userCheck] = await pool.query(
        `SELECT u.id_usuario, r.nombre AS rol_nombre
         FROM usuarios u
         LEFT JOIN roles r ON r.id_rol = u.rol_id
         WHERE u.id_usuario = ?`,
        [id]
      );
      if (!userCheck.length) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const targetRole = userCheck[0].rol_nombre || '';
      const allowedKeys = getModuleKeysByRole(targetRole);
      if (!allowedKeys.length) {
        return res.status(400).json({ message: 'Este rol no tiene permisos configurables' });
      }

      const updates = [];
      for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(permisos, key)) {
          const puedeEditar = permisos[key] ? 1 : 0;
          updates.push(pool.query(
            'INSERT INTO usuarios_permisos (usuario_id, modulo, puede_editar) VALUES (?, ?, ?) ' +
            'ON DUPLICATE KEY UPDATE puede_editar = VALUES(puede_editar)',
            [id, key, puedeEditar]
          ));
        }
      }

      await Promise.all(updates);

      res.json({ message: 'Permisos de usuario actualizados' });
    } catch (err) {
      console.error('Error PATCH /permisos/:id:', err);
      res.status(500).json({ message: 'Error actualizando permisos de usuario' });
    }
  }
};

module.exports = usuariosController;
