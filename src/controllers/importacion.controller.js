'use strict';

const importacionService = require('../services/importacion.service');
const { AppError, asyncHandler } = require('../utils/http');

/**
 * POST /api/importacion/preview
 * Recibe el Excel en el campo "archivo" y devuelve la vista previa parseada.
 */
exports.preview = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    throw new AppError(400, 'Sube un archivo Excel en el campo "archivo".');
  }

  const resultado = await importacionService.crearPreview(req.file.buffer, {
    nombreArchivo: req.file.originalname,
    idUsuario: req.user && req.user.id
  });

  res.status(201).json(resultado);
});

/**
 * POST /api/importacion/confirmar
 * Crea el proyecto borrador con los datos editados por el usuario.
 */
exports.confirmar = asyncHandler(async (req, res) => {
  const { id, ...datos } = req.body || {};

  if (!id) {
    throw new AppError(400, 'Falta el identificador de la vista previa.');
  }

  const resultado = await importacionService.confirmarImportacion(
    id,
    datos,
    req.user
  );

  res.status(201).json(resultado);
});

/**
 * DELETE /api/importacion/:id
 * Acepta el UUID de una vista previa o el id de un proyecto borrador.
 */
exports.descartar = asyncHandler(async (req, res) => {
  res.json(await importacionService.descartarImportacion(req.params.id));
});
