const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Carpeta física donde se guardan los archivos subidos.
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'evidencias');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Tipos permitidos: imágenes comunes + documentos de oficina + PDF.
const MIME_PERMITIDOS = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const nombreUnico = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, nombreUnico);
  },
});

const fileFilter = (req, file, cb) => {
  if (!MIME_PERMITIDOS.has(file.mimetype)) {
    return cb(new Error('Tipo de archivo no permitido. Solo imágenes, PDF, Word o Excel.'));
  }
  cb(null, true);
};

const uploadEvidencias = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB por archivo
    files: 5,                  // máximo 5 archivos por solicitud
  },
});

module.exports = { uploadEvidencias, UPLOAD_DIR };
