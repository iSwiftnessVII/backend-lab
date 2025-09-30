const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
// JWT removed: no token-based auth, only password hashing
const pool = require('../db');

// Register
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing email or password' });
  try {
  const [rows] = await pool.query('SELECT id FROM `login` WHERE email = ?', [email]);
    if (rows.length) return res.status(409).json({ message: 'User already exists' });
    const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query('INSERT INTO `login` (email, password_hash) VALUES (?, ?)', [email, hash]);
    const userId = result.insertId;
    res.json({ id: userId, email });
  } catch (err) {
    console.error('Register error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing email or password' });
  try {
  const [rows] = await pool.query('SELECT id, password_hash FROM `login` WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ id: user.id, email });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
