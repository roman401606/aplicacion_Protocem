'use strict';

const proyectoService = require('../services/proyecto.service');
const { asyncHandler } = require('../utils/http');

exports.listar = asyncHandler(async (req, res) => {
  res.json(await proyectoService.listar());
});

exports.obtener = asyncHandler(async (req, res) => {
  res.json(await proyectoService.obtener(req.params.id));
});

exports.crear = asyncHandler(async (req, res) => {
  res.json(await proyectoService.crear(req.body, req.user));
});

exports.actualizarAvance = asyncHandler(async (req, res) => {
  res.json(await proyectoService.actualizarAvance(req.params.id, req.body));
});

exports.eliminar = asyncHandler(async (req, res) => {
  res.json(await proyectoService.eliminar(req.params.id));
});
