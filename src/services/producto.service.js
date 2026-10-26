'use strict';

const productoRepository = require('../repositories/producto.repository');
const { AppError } = require('../utils/http');

async function listar() {
  return productoRepository.findAllWithPrecios();
}

async function crear({ descripcion, tipo_producto, unidades, precio_referencia }) {
  if (!descripcion || !unidades) throw new AppError(400, 'Faltan campos');

  const result = await productoRepository.create({
    descripcion,
    tipo_producto: tipo_producto || null,
    unidades,
    precio_referencia: precio_referencia || null
  });

  return { id: result.insertId, message: 'Producto creado' };
}

module.exports = { listar, crear };
