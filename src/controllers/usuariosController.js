const pool = require('../config/db');
const bcrypt = require('bcrypt');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { nodemailer = null; }

const SALT_ROUNDS = 10;

const usuariosController = {
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
    const { email, contrasena, rol_id } = req.body || {};

    // Validaciones
    if (!email || !contrasena || !rol_id) {
      return res.status(400).json({
        message: 'Email, contraseña y rol son requeridos'
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
        'INSERT INTO usuarios (email, contrasena, rol_id, estado) VALUES (?, ?, ?, ?)',
        [email.toLowerCase().trim(), hashedPassword, rol_id, 'ACTIVO']
      );

      // Log auditoría
      if (req.user && req.user.id) {
         const fecha = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Bogota',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
         }).format(new Date());

         await pool.query(
            'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'CREAR', 'USUARIOS', fecha, `Creación de usuario: ${email.toLowerCase().trim()}`, JSON.stringify({ rol_id, estado: 'ACTIVO' })]
         );
      }

      res.status(201).json({
        message: 'Usuario creado correctamente',
        id_usuario: result.insertId,
        email: email.toLowerCase().trim(),
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
                'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
                [req.user.id, 'ACTUALIZAR', 'USUARIOS', fecha, `Cambio de estado usuario: ${id}`, JSON.stringify(cambios)]
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
                  'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
                  [req.user.id, 'ACTUALIZAR', 'USUARIOS', fecha, `Cambio de rol usuario: ${id}`, JSON.stringify(cambios)]
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
         const cambios = {
           contrasena: { anterior: '********', nuevo: '********' }
         };

         const fecha = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Bogota',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
         }).format(new Date());

         await pool.query(
            'INSERT INTO logs_acciones (usuario_id, accion, modulo, fecha, descripcion, detalle) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'ACTUALIZAR', 'USUARIOS', fecha, `Cambio de contraseña usuario: ${id}`, JSON.stringify(cambios)]
         );
      }
      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
      console.error('Error PATCH /contrasena/:id:', err);
      res.status(500).json({ message: 'Error actualizando contraseña' });
    }
  }
};

module.exports = usuariosController;
