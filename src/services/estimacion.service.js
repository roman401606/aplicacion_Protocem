'use strict';

const estimacionRepository = require('../repositories/estimacion.repository');
const { withTransaction } = require('../repositories/base.repository');
const { AppError } = require('../utils/http');

async function listarPorProyecto(idProyecto) {
  return estimacionRepository.findByProyecto(idProyecto);
}

async function obtener(id) {
  const estimacion = await estimacionRepository.findById(id);
  if (!estimacion) throw new AppError(404, 'No encontrada');

  const [detalle, acumulado_anterior] = await Promise.all([
    estimacionRepository.findDetalle(id),
    estimacionRepository.findAcumuladoAnterior(
      estimacion.id_proyecto,
      estimacion.numero
    )
  ]);

  return { estimacion, detalle, acumulado_anterior };
}

async function crear(idProyecto, { periodo_inicio, periodo_fin, fecha_presentacion, observaciones, items }) {
  if (!periodo_inicio || !periodo_fin || !Array.isArray(items) || !items.length) {
    throw new AppError(400, 'Faltan datos');
  }

  const total = items.reduce(
    (sum, item) => sum + item.cantidad_periodo * item.precio_unitario,
    0
  );

  return withTransaction(async conn => {
    const numero = await estimacionRepository.nextNumber(conn, idProyecto);

    const estimacion = await estimacionRepository.create(conn, {
      id_proyecto: idProyecto,
      numero,
      periodo_inicio,
      periodo_fin,
      fecha_presentacion: fecha_presentacion || null,
      total,
      observaciones: observaciones || null
    });

    for (const item of items) {
      await estimacionRepository.createDetalle(conn, {
        id_estimacion: estimacion.insertId,
        id_concepto: item.id_concepto,
        cantidad_periodo: item.cantidad_periodo,
        precio_unitario: item.precio_unitario
      });
      await estimacionRepository.createGenerador(conn, {
        id_concepto: item.id_concepto,
        numero,
        periodo_fin,
        cantidad_periodo: item.cantidad_periodo
      });
    }

    return {
      id: estimacion.insertId,
      numero,
      total,
      message: `Estimación ${numero} creada`
    };
  });
}

async function actualizarEstado(id, estado) {
  const estados = ['borrador', 'presentada', 'aprobada', 'pagada'];
  if (!estados.includes(estado)) throw new AppError(400, 'Estado inválido');

  await estimacionRepository.updateEstado(id, estado);
  return { message: 'Estado actualizado' };
}

async function acumulado(idProyecto) {
  const [estimaciones, proyecto] = await Promise.all([
    estimacionRepository.acumuladoByProyecto(idProyecto),
    estimacionRepository.findPresupuesto(idProyecto)
  ]);

  const totalCobrado = estimaciones.reduce(
    (sum, row) => sum + parseFloat(row.total_estimacion || 0),
    0
  );

  return {
    estimaciones,
    presupuesto: proyecto?.presupuesto || 0,
    total_cobrado: totalCobrado
  };
}

module.exports = { listarPorProyecto, obtener, crear, actualizarEstado, acumulado };
