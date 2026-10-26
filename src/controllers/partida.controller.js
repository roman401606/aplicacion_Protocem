'use strict';

const partidaService = require('../services/partida.service');
const { asyncHandler } = require('../utils/http');

exports.listarPorProyecto = asyncHandler(async (req, res) => {
  res.json(await partidaService.listarPorProyecto(req.params.id));
});

exports.crear = asyncHandler(async (req, res) => {
  res.json(await partidaService.crear(req.params.id, req.body));
});

exports.actualizar = asyncHandler(async (req, res) => {
  res.json(await partidaService.actualizar(req.params.id_partida, req.body));
});

exports.eliminar = asyncHandler(async (req, res) => {
  res.json(await partidaService.eliminar(req.params.id_partida));
});

exports.listarConceptos = asyncHandler(async (req, res) => {
  res.json(await partidaService.listarConceptos(req.params.id_partida));
});

exports.crearConcepto = asyncHandler(async (req, res) => {
  res.json(await partidaService.crearConcepto(req.params.id_partida, req.body));
});

exports.actualizarConcepto = asyncHandler(async (req, res) => {
  res.json(await partidaService.actualizarConcepto(req.params.id_concepto, req.body));
});

exports.eliminarConcepto = asyncHandler(async (req, res) => {
  res.json(await partidaService.eliminarConcepto(req.params.id_concepto));
});

exports.obtenerApu = asyncHandler(async (req, res) => {
  res.json(await partidaService.obtenerApu(req.params.id_concepto));
});

exports.crearApuMaterial = asyncHandler(async (req, res) => {
  res.json(await partidaService.crearApuMaterial(req.params.id_concepto, req.body));
});

exports.crearApuManoObra = asyncHandler(async (req, res) => {
  res.json(await partidaService.crearApuManoObra(req.params.id_concepto, req.body));
});

exports.crearApuMaquinaria = asyncHandler(async (req, res) => {
  res.json(await partidaService.crearApuMaquinaria(req.params.id_concepto, req.body));
});

exports.listarGeneradores = asyncHandler(async (req, res) => {
  res.json(await partidaService.listarGeneradores(req.params.id_concepto));
});

exports.crearGenerador = asyncHandler(async (req, res) => {
  res.json(await partidaService.crearGenerador(req.params.id_concepto, req.body));
});

exports.explosion = asyncHandler(async (req, res) => {
  res.json(await partidaService.explosion(req.params.id));
});

exports.resumen = asyncHandler(async (req, res) => {
  res.json(await partidaService.resumen(req.params.id));
});
