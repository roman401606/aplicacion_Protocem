'use strict';

const productoService = require('../services/producto.service');
const { asyncHandler } = require('../utils/http');

exports.listar = asyncHandler(async (req, res) => {
  res.json(await productoService.listar());
});

exports.crear = asyncHandler(async (req, res) => {
  res.json(await productoService.crear(req.body));
});
