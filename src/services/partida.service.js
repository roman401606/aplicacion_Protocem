'use strict';

const partidaRepository = require('../repositories/partida.repository');
const { AppError } = require('../utils/http');

async function listarPorProyecto(idProyecto) {
  return partidaRepository.findByProyecto(idProyecto);
}

async function crear(idProyecto, { numero, nombre, descripcion, orden }) {
  if (!numero || !nombre) throw new AppError(400, 'numero y nombre son requeridos');

  const result = await partidaRepository.create(idProyecto, {
    numero,
    nombre,
    descripcion: descripcion || null,
    orden: orden || 0
  });

  return { id: result.insertId, message: 'Partida creada' };
}

async function actualizar(idPartida, { numero, nombre, descripcion, orden }) {
  await partidaRepository.update(idPartida, {
    numero: numero || null,
    nombre: nombre || null,
    descripcion: descripcion || null,
    orden: orden ?? null
  });
  return { message: 'Partida actualizada' };
}

async function eliminar(idPartida) {
  await partidaRepository.remove(idPartida);
  return { message: 'Partida eliminada' };
}

async function listarConceptos(idPartida) {
  return partidaRepository.findConceptos(idPartida);
}

async function crearConcepto(idPartida, body) {
  const { descripcion, unidad, cantidad, precio_unitario } = body;
  if (!descripcion || !unidad || cantidad == null || precio_unitario == null) {
    throw new AppError(400, 'Faltan campos obligatorios');
  }

  const result = await partidaRepository.createConcepto(idPartida, {
    id_catalogo: body.id_catalogo || null,
    clave: body.clave || null,
    descripcion,
    unidad,
    cantidad,
    precio_unitario,
    orden: body.orden || 0
  });

  return { id: result.insertId, message: 'Concepto creado' };
}

async function actualizarConcepto(idConcepto, body) {
  await partidaRepository.updateConcepto(idConcepto, {
    clave: body.clave || null,
    descripcion: body.descripcion || null,
    unidad: body.unidad || null,
    cantidad: body.cantidad ?? null,
    precio_unitario: body.precio_unitario ?? null,
    orden: body.orden ?? null
  });
  return { message: 'Concepto actualizado' };
}

async function eliminarConcepto(idConcepto) {
  await partidaRepository.removeConcepto(idConcepto);
  return { message: 'Concepto eliminado' };
}

async function obtenerApu(idConcepto) {
  const [concepto, materiales, mano_obra, maquinaria] = await Promise.all([
    partidaRepository.findApuConcepto(idConcepto),
    partidaRepository.findApuMateriales(idConcepto),
    partidaRepository.findApuManoObra(idConcepto),
    partidaRepository.findApuMaquinaria(idConcepto)
  ]);

  const totalMat = materiales.reduce((sum, row) => sum + parseFloat(row.importe || 0), 0);
  const totalMO = mano_obra.reduce((sum, row) => sum + parseFloat(row.importe || 0), 0);
  const totalMaq = maquinaria.reduce((sum, row) => sum + parseFloat(row.importe || 0), 0);
  const herramienta = totalMO * 0.03;
  const totalAPU = totalMat + totalMO + totalMaq + herramienta;

  return {
    concepto,
    materiales,
    mano_obra,
    maquinaria,
    totales: {
      materiales: totalMat,
      mano_obra: totalMO,
      maquinaria: totalMaq,
      herramienta,
      total_apu: totalAPU
    }
  };
}

async function crearApuMaterial(idConcepto, body) {
  const { descripcion, unidad, cantidad, precio_unit } = body;
  if (!descripcion || !unidad || cantidad == null || precio_unit == null) {
    throw new AppError(400, 'Faltan campos');
  }

  const result = await partidaRepository.createApuMaterial(idConcepto, {
    id_producto: body.id_producto || null,
    descripcion,
    unidad,
    cantidad,
    precio_unit
  });

  return { id: result.insertId, message: 'Material APU registrado' };
}

async function crearApuManoObra(idConcepto, body) {
  const { categoria, rendimiento, salario_real } = body;
  if (!categoria || rendimiento == null || salario_real == null) {
    throw new AppError(400, 'Faltan campos');
  }

  const result = await partidaRepository.createApuManoObra(idConcepto, {
    id_fasar: body.id_fasar || null,
    categoria,
    rendimiento,
    salario_real
  });

  return { id: result.insertId, message: 'Mano de obra APU registrada' };
}

async function crearApuMaquinaria(idConcepto, { descripcion, rendimiento, costo_hora }) {
  if (!descripcion || rendimiento == null || costo_hora == null) {
    throw new AppError(400, 'Faltan campos');
  }

  const result = await partidaRepository.createApuMaquinaria(idConcepto, {
    descripcion,
    rendimiento,
    costo_hora
  });

  return { id: result.insertId, message: 'Maquinaria APU registrada' };
}

async function listarGeneradores(idConcepto) {
  const [generadores, resumen] = await Promise.all([
    partidaRepository.findGeneradores(idConcepto),
    partidaRepository.resumenGeneradores(idConcepto)
  ]);
  return { generadores, resumen };
}

async function crearGenerador(idConcepto, body) {
  const { numero_estimacion, cantidad_periodo, fecha_generador } = body;
  if (!numero_estimacion || cantidad_periodo == null || !fecha_generador) {
    throw new AppError(400, 'Faltan campos');
  }

  const result = await partidaRepository.createGenerador(idConcepto, {
    numero_estimacion,
    descripcion: body.descripcion || null,
    cantidad_periodo,
    fecha_generador
  });

  return { id: result.insertId, message: 'Generador registrado' };
}

async function explosion(idProyecto) {
  const [materiales, mano_obra] = await Promise.all([
    partidaRepository.explosionMateriales(idProyecto),
    partidaRepository.explosionManoObra(idProyecto)
  ]);
  return { materiales, mano_obra };
}

async function resumen(idProyecto) {
  const [partidas, totales] = await Promise.all([
    partidaRepository.resumenPartidas(idProyecto),
    partidaRepository.resumenTotales(idProyecto)
  ]);
  return { partidas, totales };
}

module.exports = {
  listarPorProyecto,
  crear,
  actualizar,
  eliminar,
  listarConceptos,
  crearConcepto,
  actualizarConcepto,
  eliminarConcepto,
  obtenerApu,
  crearApuMaterial,
  crearApuManoObra,
  crearApuMaquinaria,
  listarGeneradores,
  crearGenerador,
  explosion,
  resumen
};
