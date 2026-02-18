const express = require('express');
const multer = require('multer');
const { verifyToken } = require('../middleware/jwt');
const excelController = require('../controllers/excelController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

/* POST /api/excel/unlock - Desbloquear hojas Excel */
router.post('/unlock', verifyToken, upload.single('file'), excelController.unlockExcel);

/* POST /api/excel/lock - Bloquear hojas Excel */
router.post('/lock', verifyToken, upload.single('file'), excelController.lockExcel);

module.exports = router;
