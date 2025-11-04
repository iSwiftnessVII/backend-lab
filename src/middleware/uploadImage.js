const multer = require('multer');

// Dedicated uploader for small images (e.g., catalog thumbnails)
// Keep PDF uploader limits separate to avoid breaking larger PDFs elsewhere.
const storage = multer.memoryStorage();

// Cap images at 5MB to avoid huge BLOBs in DB
const uploadImage = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = uploadImage;
