'use strict';

const cotizacionRepository = require('../repositories/cotizacion.repository');
const catalogoRepository = require('../repositories/catalogo.repository');
const { AppError } = require('../utils/http');

async function listar() {
  return cotizacionRepository.findAll();
}

async function crear({ id_producto, id_proveedor, fecha_cotizacion, precio_cotizado }) {
  if (!id_producto || !id_proveedor || !fecha_cotizacion || !precio_cotizado) {
    throw new AppError(400, 'Todos los campos son obligatorios');
  }

  const result = await cotizacionRepository.create({
    fecha_cotizacion,
    precio_cotizado,
    id_producto,
    id_proveedor
  });

  return { id: result.insertId, message: 'Cotizacion registrada' };
}

async function listarCatalogo(query) {
  const limit = Math.min(parseInt(query.limit, 10) || 200, 500);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  const { especialidad, fuente, q } = query;

  return catalogoRepository.find({
    especialidad,
    fuente,
    q,
    limit,
    offset,
    onlyWithPrice: true
  });
}

module.exports = { listar, crear, listarCatalogo };
