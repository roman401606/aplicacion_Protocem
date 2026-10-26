'use strict';

const compraService = require('../services/compra.service');
const { asyncHandler } = require('../utils/http');

exports.listar = asyncHandler(async (req, res) => {
  res.json(await compraService.listar());
});

exports.crear = asyncHandler(async (req, res) => {
  res.json(await compraService.crear(req.body));
});
