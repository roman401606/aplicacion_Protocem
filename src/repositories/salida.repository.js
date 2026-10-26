'use strict';

const { query, run } = require('./base.repository');

async function findAll() {
  return query(`
    SELECT s.id_salida, s.fecha_salida, s.responsable, s.tipo_salida, s.total_salida, p.nombre_obra,
      GROUP_CONCAT(CONCAT(pr.descripcion,' x',ds.cantidad) ORDER BY ds.id_detalle_salida SEPARATOR ' | ') as detalle
    FROM SALIDA s JOIN PROYECTO p ON p.id_proyecto=s.id_proyecto
    LEFT JOIN DETALLE_SALIDA ds ON ds.id_salida=s.id_salida
    LEFT JOIN PRODUCTO pr ON pr.id_producto=ds.id_producto
    GROUP BY s.id_salida ORDER BY s.fecha_salida DESC`);
}

async function create(conn, { fecha_salida, responsable, tipo_salida, id_proyecto }) {
  return run(
    'INSERT INTO SALIDA (fecha_salida,responsable,tipo_salida,id_proyecto) VALUES (?,?,?,?)',
    [fecha_salida, responsable, tipo_salida, id_proyecto],
    conn
  );
}

async function createDetalle(conn, { id_salida, id_producto, cantidad }) {
  return run(
    'INSERT INTO DETALLE_SALIDA (id_salida,id_producto,cantidad) VALUES (?,?,?)',
    [id_salida, id_producto, cantidad],
    conn
  );
}

async function decrementarStock(conn, { id_producto, cantidad }) {
  return run(
    'UPDATE PRODUCTO SET stock=GREATEST(0,stock-?) WHERE id_producto=?',
    [cantidad, id_producto],
    conn
  );
}

module.exports = { findAll, create, createDetalle, decrementarStock };
