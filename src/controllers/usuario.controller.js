'use strict';

const usuarioService = require('../services/usuario.service');
const { asyncHandler } = require('../utils/http');

exports.listar = asyncHandler(async (req, res) => {
  res.json(await usuarioService.listar());
});

exports.crear = asyncHandler(async (req, res) => {
  res.json(await usuarioService.crear(req.body));
});
