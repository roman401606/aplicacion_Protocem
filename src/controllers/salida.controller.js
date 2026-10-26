'use strict';

const salidaService = require('../services/salida.service');
const { asyncHandler } = require('../utils/http');

exports.listar = asyncHandler(async (req, res) => {
  res.json(await salidaService.listar());
});

exports.crear = asyncHandler(async (req, res) => {
  res.json(await salidaService.crear(req.body));
});
