'use strict';

const compraRepository = require('../repositories/compra.repository');
const { withTransaction } = require('../repositories/base.repository');
const { AppError } = require('../utils/http');

async function listar() {
  return compraRepository.findAll();
}

async function crear({ id_proyecto, fecha_compra, items }) {
  if (!id_proyecto || !fecha_compra || !Array.isArray(items) || !items.length) {
    throw new AppError(400, 'Faltan datos');
  }

  const total = items.reduce((sum, item) => sum + item.cantidad * item.precio_unitario_real, 0);

  return withTransaction(async conn => {
    const compra = await compraRepository.create(conn, {
      fecha_compra,
      total,
      id_proyecto
    });

    for (const item of items) {
      await compraRepository.createDetalle(conn, {
        id_compra: compra.insertId,
        id_producto: item.id_producto,
        cantidad: item.cantidad,
        precio_unitario_real: item.precio_unitario_real
      });
      await compraRepository.incrementarStock(conn, {
        id_producto: item.id_producto,
        cantidad: item.cantidad
      });
    }

    return { id: compra.insertId, total, message: 'Compra registrada' };
  });
}

module.exports = { listar, crear };
