// referencia routes removed — router that returns 410 for all methods
const express = require('express');
const router = express.Router();

router.all('*', (_req, res) => res.status(410).json({ message: 'Material referencia removed' }));

module.exports = router;
