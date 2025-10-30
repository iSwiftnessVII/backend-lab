const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB máximo
});


module.exports = upload;