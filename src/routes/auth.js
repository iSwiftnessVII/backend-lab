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

// Whoami - return user info when Authorization: Bearer <token> is present
router.get('/me', async (req, res) => {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (!auth) return res.status(401).json({ message: 'Missing token' });
  // NOTE: this backend is minimal for local dev. We don't validate tokens here.
  // If needed, implement JWT verification. For now treat any Bearer token as valid
  // and return a lightweight user placeholder.
  try {
    return res.json({ id: 1, email: 'restored@example.com' });
  } catch (err) {
    console.error('whoami error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
