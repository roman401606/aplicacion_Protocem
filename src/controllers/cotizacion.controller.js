'use strict';

const cotizacionService = require('../services/cotizacion.service');
const { asyncHandler } = require('../utils/http');

exports.listar = asyncHandler(async (req, res) => {
  res.json(await cotizacionService.listar());
});

exports.crear = asyncHandler(async (req, res) => {
  res.json(await cotizacionService.crear(req.body));
});

exports.catalogo = asyncHandler(async (req, res) => {
  res.json(await cotizacionService.listarCatalogo(req.query));
});
