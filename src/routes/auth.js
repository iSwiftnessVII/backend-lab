const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Login
router.post('/login', authController.login);

// Whoami
router.get('/me', authController.me);

module.exports = router;