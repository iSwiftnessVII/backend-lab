const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function isDbConnectivityError(err) {
  const code = err && err.code;
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNRESET' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ER_ACCESS_DENIED_ERROR' ||
    code === 'ER_BAD_DB_ERROR'
  );
}

const authController = {
  // Login con JWT
  login: async (req, res) => {
    const { email, contrasena } = req.body;
    
    if (!email || !contrasena) {
      return res.status(400).json({ message: 'Falta correo o contraseña' });
    }

    try {
      // INCLUIR el rol en la consulta
      const [rows] = await pool.query(
        `SELECT u.id_usuario, u.nombre, u.contrasena, u.estado, r.nombre as rol_nombre, r.id_rol 
         FROM usuarios u 
         JOIN roles r ON u.rol_id = r.id_rol 
         WHERE u.email = ?`,
        [email]
      );
      
      if (!rows.length) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }
      
      const user = rows[0];
      
      // Verificar si el usuario está activo
      if (user.estado !== 'ACTIVO') {
        return res.status(401).json({ message: 'Usuario inactivo' });
      }

      // Si el hash no existe, tratarlo como credencial inválida (evita 500)
      if (!user.contrasena) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }
      
      const ok = await bcrypt.compare(contrasena, user.contrasena);
      if (!ok) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      // Generar JWT
      const token = jwt.sign(
        { 
          id: user.id_usuario, 
          email: email,
          rol: user.rol_nombre,
          id_rol: user.id_rol 
        },
        process.env.JWT_SECRET || 'secreto-temporal-desarrollo',
        { expiresIn: '24h' }
      );

      // Devolver información del rol + token
      res.json({ 
        id_usuario: user.id_usuario, 
        email: email,
        nombre: user.nombre,
        rol: user.rol_nombre,
        id_rol: user.id_rol,
        token: token
      });
      
    } catch (err) {
      console.error('Login error', err);

      if (isDbConnectivityError(err)) {
        return res.status(503).json({
          message: 'No hay conexión con la base de datos',
          code: err.code
        });
      }

      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  },

  // Whoami - verificar token JWT
  me: async (req, res) => {
    const auth = req.headers['authorization'] || req.headers['Authorization'];
    if (!auth) return res.status(401).json({ message: 'Token requerido' });
    
    try {
      const token = auth.replace('Bearer ', '');
      
      // Verificar JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto-temporal-desarrollo');
      
      // Verificar que el usuario aún existe en la BD
      const [rows] = await pool.query(
        `SELECT u.id_usuario, u.email, u.nombre, u.estado, r.nombre as rol_nombre, r.id_rol 
         FROM usuarios u 
         JOIN roles r ON u.rol_id = r.id_rol 
         WHERE u.id_usuario = ? AND u.estado = 'ACTIVO'`,
        [decoded.id]
      );
      
      if (!rows.length) {
        return res.status(401).json({ message: 'Usuario no encontrado o inactivo' });
      }
      
      const user = rows[0];
      return res.json({ 
        id: user.id_usuario, 
        email: user.email,
        nombre: user.nombre,
        rol: user.rol_nombre,
        id_rol: user.id_rol
      });
      
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Token inválido' });
      }
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expirado' });
      }

      if (isDbConnectivityError(err)) {
        return res.status(503).json({
          message: 'No hay conexión con la base de datos',
          code: err.code
        });
      }
      
      console.error('whoami error', err);
      return res.status(500).json({ message: 'Error del servidor' });
    }
  }
};

module.exports = authController;
