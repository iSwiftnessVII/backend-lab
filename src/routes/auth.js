const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');

// Login
router.post('/login', async (req, res) => {
  const { email, contrasena } = req.body;
  if (!email || !contrasena)
    return res.status(400).json({ message: 'Falta correo o contraseña' });

  try {
    const [rows] = await pool.query(
      'SELECT id_usuario, contrasena FROM usuarios WHERE email = ?',
      [email]
    );
    if (!rows.length)
      return res.status(401).json({ message: 'Credenciales inválidas' });
    const user = rows[0];
    const ok = await bcrypt.compare(contrasena, user.contrasena);

    if (!ok)
      return res.status(401).json({ message: 'Credenciales inválidas' });

    res.json({ id_usuario: user.id_usuario, email });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
