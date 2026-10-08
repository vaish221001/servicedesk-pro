const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('./AppError');

// Base directory for local development attachment storage
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/attachments');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 10 MB maximum file size limit
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Permitted MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
]);

// Storage configuration with filename sanitization and unique prefix
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Sanitize filename against path traversal
    const safeBaseName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniquePrefix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${uniquePrefix}-${safeBaseName}`);
  },
});

// File filter validator
const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      new AppError(
        `File type '${file.mimetype}' is not permitted. Allowed: Images, PDF, Word, Excel, CSV, Text, Zip`,
        400
      ),
      false
    );
  }
  cb(null, true);
};

// Multer upload middleware (supports up to 5 files per comment)
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter,
});

/**
 * Validates path security and returns the full absolute path of a stored file.
 * Prevents directory traversal attacks.
 *
 * @param {string} filename - Stored filename
 * @returns {string} Absolute file path
 */
const getSafeFilePath = (filename) => {
  if (!filename || typeof filename !== 'string') {
    throw new AppError('Invalid attachment filename', 400);
  }

  // Prevent directory traversal
  const sanitized = path.basename(filename);
  const fullPath = path.resolve(UPLOAD_DIR, sanitized);

  if (!fullPath.startsWith(UPLOAD_DIR)) {
    throw new AppError('Illegal file access path', 403);
  }

  if (!fs.existsSync(fullPath)) {
    throw new AppError('Attachment file not found', 404);
  }

  return fullPath;
};

module.exports = {
  upload,
  UPLOAD_DIR,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  getSafeFilePath,
};
