const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

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
        `SELECT u.id_usuario, u.contrasena, u.estado, r.nombre as rol_nombre, r.id_rol 
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
        rol: user.rol_nombre,
        id_rol: user.id_rol,
        token: token
      });
      
    } catch (err) {
      console.error('Login error', err);
      res.status(500).json({ message: 'Error interno del servidor' });
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
        `SELECT u.id_usuario, u.email, u.estado, r.nombre as rol_nombre, r.id_rol 
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
      
      console.error('whoami error', err);
      return res.status(500).json({ message: 'Error del servidor' });
    }
  }
};

module.exports = authController;