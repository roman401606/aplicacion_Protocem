'use strict';

const catalogoService = require('../services/catalogo.service');
const { asyncHandler } = require('../utils/http');

exports.listar = asyncHandler(async (req, res) => {
  res.json(await catalogoService.listar(req.query));
});

exports.especialidades = asyncHandler(async (req, res) => {
  res.json(await catalogoService.listarEspecialidades());
});

exports.fasar = asyncHandler(async (req, res) => {
  res.json(await catalogoService.listarFasar(req.query.zona));
});

exports.crear = asyncHandler(async (req, res) => {
  res.json(await catalogoService.crear(req.body));
});

exports.actualizar = asyncHandler(async (req, res) => {
  res.json(await catalogoService.actualizar(req.params.id, req.body));
});
