const express = require('express');
const router = express.Router();
const notificacionesController = require('../controllers/notificacionesController');
const { verifyToken } = require('../middleware/jwt');

router.get('/reads', verifyToken, notificacionesController.getReads);
router.post('/reads', verifyToken, notificacionesController.markReads);

module.exports = router;
