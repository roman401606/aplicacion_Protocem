'use strict';

const { query, run } = require('./base.repository');

async function findAllWithPrecios() {
  return query(`
    SELECT p.*,
      (SELECT MAX(dc.precio_unitario_real) FROM DETALLE_COMPRA dc WHERE dc.id_producto=p.id_producto) as precio_ultimo_real,
      (SELECT MAX(co.precio_cotizado) FROM COTIZACION co WHERE co.id_producto=p.id_producto) as precio_cotizado_ref
    FROM PRODUCTO p ORDER BY p.tipo_producto, p.descripcion`);
}

async function findAllBasic() {
  return query('SELECT * FROM PRODUCTO ORDER BY id_producto');
}

async function findById(id) {
  const rows = await query('SELECT * FROM PRODUCTO WHERE id_producto=?', [id]);
  return rows[0] || null;
}

async function create({ descripcion, tipo_producto, unidades, precio_referencia }) {
  return run(
    'INSERT INTO PRODUCTO (descripcion,tipo_producto,unidades,precio_referencia) VALUES (?,?,?,?)',
    [descripcion, tipo_producto, unidades, precio_referencia]
  );
}

module.exports = { findAllWithPrecios, findAllBasic, findById, create };
