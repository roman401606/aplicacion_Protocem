'use strict';

const salidaRepository = require('../repositories/salida.repository');
const { withTransaction } = require('../repositories/base.repository');
const { AppError } = require('../utils/http');

async function listar() {
  return salidaRepository.findAll();
}

async function crear({ id_proyecto, fecha_salida, responsable, tipo_salida, items }) {
  if (!id_proyecto || !fecha_salida || !responsable || !Array.isArray(items) || !items.length) {
    throw new AppError(400, 'Faltan datos');
  }

  return withTransaction(async conn => {
    const salida = await salidaRepository.create(conn, {
      fecha_salida,
      responsable,
      tipo_salida: tipo_salida || 'consumo',
      id_proyecto
    });

    for (const item of items) {
      await salidaRepository.createDetalle(conn, {
        id_salida: salida.insertId,
        id_producto: item.id_producto,
        cantidad: item.cantidad
      });
      await salidaRepository.decrementarStock(conn, {
        id_producto: item.id_producto,
        cantidad: item.cantidad
      });
    }

    return { id: salida.insertId, message: 'Salida registrada' };
  });
}

module.exports = { listar, crear };
