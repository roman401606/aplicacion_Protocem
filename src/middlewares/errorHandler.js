'use strict';

const config = require('../../config');
const { AppError } = require('../utils/http');

/**
 * Middleware global de errores.
 * Convierte cualquier error no controlado en una respuesta JSON estable.
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';

  // Body JSON mal formado enviado por el cliente.
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'JSON invalido en el cuerpo de la peticion';
  }

  // Errores de Multer al subir archivos.
  if (err.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;

    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMb = Math.round(config.uploadsMaxSize / (1024 * 1024));
      message = `El archivo supera el limite de ${maxMb} MB`;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Campo de archivo invalido. Usa el campo "archivo".';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Solo se permite un archivo por importacion.';
    } else {
      message = 'Error al procesar el archivo subido.';
    }
  }

  // Errores de MySQL que representan datos invalidos, no fallas del servidor.
  if (err.code === 'ER_DUP_ENTRY') {
    status = 400;
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    status = 400;
  }

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    if (config.isProduction && !err.isOperational) {
      message = 'Error interno del servidor';
    }
  }

  res.status(status).json({ error: message });
}

/**
 * 404 explicito para consumidores de API.
 * Se expone por si en el futuro se decide separar el fallback SPA.
 */
function notFound(req, res, next) {
  next(new AppError(404, 'Recurso no encontrado'));
}

module.exports = { errorHandler, notFound };
