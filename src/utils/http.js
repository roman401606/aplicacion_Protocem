'use strict';

/**
 * Error de aplicacion con codigo HTTP asociado.
 * Los services lo lanzan y el errorHandler global lo traduce a JSON.
 */
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.isOperational = true;
  }
}

/**
 * Envuelve handlers async para que cualquier promesa rechazada
 * llegue al middleware global de errores (Express 4 no lo hace solo).
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { AppError, asyncHandler };
