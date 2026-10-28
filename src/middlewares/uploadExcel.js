'use strict';

const path = require('path');
const multer = require('multer');
const config = require('../../config');
const { AppError } = require('../utils/http');

/**
 * Extensiones de Excel aceptadas por el importador.
 * La validacion por extension es mas confiable que el MIME que envia el navegador.
 */
const EXTENSIONES_PERMITIDAS = new Set(['.xlsx', '.xls']);

const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (!EXTENSIONES_PERMITIDAS.has(extension)) {
    return cb(new AppError(400, 'Formato no permitido. Sube un archivo .xlsx o .xls.'));
  }

  cb(null, true);
}

/**
 * Subida de un solo Excel en memoria.
 * El parser recibe el buffer directamente; no se guardan archivos crudos en disco.
 */
const uploadExcel = multer({
  storage,
  limits: {
    fileSize: config.uploadsMaxSize,
    files: 1
  },
  fileFilter
});

module.exports = { uploadExcel, EXTENSIONES_PERMITIDAS };
