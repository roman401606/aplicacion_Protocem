'use strict';

const { query, run } = require('./base.repository');

async function findAll() {
  return query(`
    SELECT co.*, pr.descripcion as producto, pr.unidades, pv.nombre as proveedor, pv.empresa,
      ROUND((SELECT AVG(dc.precio_unitario_real) FROM DETALLE_COMPRA dc WHERE dc.id_producto=co.id_producto),2) as precio_real_promedio,
      ROUND(((SELECT AVG(dc.precio_unitario_real) FROM DETALLE_COMPRA dc WHERE dc.id_producto=co.id_producto)-co.precio_cotizado)/co.precio_cotizado*100,1) as desviacion_pct
    FROM COTIZACION co
    JOIN PRODUCTO pr ON pr.id_producto=co.id_producto
    JOIN PROVEEDOR pv ON pv.id_proveedor=co.id_proveedor
    ORDER BY co.fecha_cotizacion DESC`);
}

async function create({ fecha_cotizacion, precio_cotizado, id_producto, id_proveedor }) {
  return run(
    'INSERT INTO COTIZACION (fecha_cotizacion,precio_cotizado,id_producto,id_proveedor) VALUES (?,?,?,?)',
    [fecha_cotizacion, precio_cotizado, id_producto, id_proveedor]
  );
}

async function createWithConnection(conn, { fecha_cotizacion, precio_cotizado, id_producto, id_proveedor }) {
  return run(
    'INSERT INTO COTIZACION (fecha_cotizacion,precio_cotizado,id_producto,id_proveedor) VALUES (?,?,?,?)',
    [fecha_cotizacion, precio_cotizado, id_producto, id_proveedor],
    conn
  );
}

module.exports = { findAll, create, createWithConnection };
