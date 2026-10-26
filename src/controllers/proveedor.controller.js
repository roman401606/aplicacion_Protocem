'use strict';

const proveedorService = require('../services/proveedor.service');
const { asyncHandler } = require('../utils/http');

exports.listar = asyncHandler(async (req, res) => {
  res.json(await proveedorService.listar());
});

exports.crear = asyncHandler(async (req, res) => {
  res.json(await proveedorService.crear(req.body));
});
