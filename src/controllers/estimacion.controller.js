'use strict';

const estimacionService = require('../services/estimacion.service');
const { asyncHandler } = require('../utils/http');

exports.listarPorProyecto = asyncHandler(async (req, res) => {
  res.json(await estimacionService.listarPorProyecto(req.params.id));
});

exports.obtener = asyncHandler(async (req, res) => {
  res.json(await estimacionService.obtener(req.params.id));
});

exports.crear = asyncHandler(async (req, res) => {
  res.json(await estimacionService.crear(req.params.id, req.body));
});

exports.actualizarEstado = asyncHandler(async (req, res) => {
  res.json(await estimacionService.actualizarEstado(req.params.id, req.body.estado));
});

exports.acumulado = asyncHandler(async (req, res) => {
  res.json(await estimacionService.acumulado(req.params.id));
});
