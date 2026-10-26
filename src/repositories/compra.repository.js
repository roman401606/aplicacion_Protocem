'use strict';

const { query, run } = require('./base.repository');

async function findAll() {
  return query(`
    SELECT c.id_compra, c.fecha_compra, c.total_compra, p.nombre_obra,
      GROUP_CONCAT(CONCAT(pr.descripcion,' x',dc.cantidad,' @ $',dc.precio_unitario_real) ORDER BY dc.id_detalle SEPARATOR ' | ') as detalle
    FROM COMPRA c JOIN PROYECTO p ON p.id_proyecto=c.id_proyecto
    LEFT JOIN DETALLE_COMPRA dc ON dc.id_compra=c.id_compra
    LEFT JOIN PRODUCTO pr ON pr.id_producto=dc.id_producto
    GROUP BY c.id_compra ORDER BY c.fecha_compra DESC`);
}

async function create(conn, { fecha_compra, total, id_proyecto }) {
  return run(
    'INSERT INTO COMPRA (fecha_compra,total_compra,id_proyecto) VALUES (?,?,?)',
    [fecha_compra, total, id_proyecto],
    conn
  );
}

async function createDetalle(conn, { id_compra, id_producto, cantidad, precio_unitario_real }) {
  return run(
    'INSERT INTO DETALLE_COMPRA (id_compra,id_producto,cantidad,precio_unitario_real) VALUES (?,?,?,?)',
    [id_compra, id_producto, cantidad, precio_unitario_real],
    conn
  );
}

async function incrementarStock(conn, { id_producto, cantidad }) {
  return run(
    'UPDATE PRODUCTO SET stock=stock+? WHERE id_producto=?',
    [cantidad, id_producto],
    conn
  );
}

module.exports = { findAll, create, createDetalle, incrementarStock };
