'use strict';

const { query, run } = require('./base.repository');

async function findByProyecto(idProyecto) {
  return query(`
    SELECT e.*,
      pr.nombre_obra,
      COUNT(de.id_det_est) as num_conceptos,
      COALESCE(SUM(de.importe),0) as total_calculado
    FROM ESTIMACION e
    JOIN PROYECTO pr ON pr.id_proyecto = e.id_proyecto
    LEFT JOIN DETALLE_ESTIMACION de ON de.id_estimacion = e.id_estimacion
    WHERE e.id_proyecto = ?
    GROUP BY e.id_estimacion
    ORDER BY e.numero DESC`, [idProyecto]);
}

async function findById(id) {
  const rows = await query(`
    SELECT e.*, pr.nombre_obra, pr.zona
    FROM ESTIMACION e
    JOIN PROYECTO pr ON pr.id_proyecto = e.id_proyecto
    WHERE e.id_estimacion = ?`, [id]);
  return rows[0] || null;
}

async function findDetalle(id) {
  return query(`
    SELECT de.*, co.clave, co.descripcion as concepto_desc, co.unidad,
      pa.numero as partida_num, pa.nombre as partida_nombre,
      co.cantidad as cantidad_contratada,
      COALESCE(SUM(g.cantidad_periodo),0) as cantidad_ejecutada_acum
    FROM DETALLE_ESTIMACION de
    JOIN CONCEPTO co ON co.id_concepto = de.id_concepto
    JOIN PARTIDA pa ON pa.id_partida = co.id_partida
    LEFT JOIN GENERADOR g ON g.id_concepto = co.id_concepto
    WHERE de.id_estimacion = ?
    GROUP BY de.id_det_est
    ORDER BY pa.orden, co.orden`, [id]);
}

async function findAcumuladoAnterior(idProyecto, numero) {
  const rows = await query(`
    SELECT COALESCE(SUM(de2.importe),0) as acumulado_anterior
    FROM DETALLE_ESTIMACION de2
    JOIN ESTIMACION e2 ON e2.id_estimacion = de2.id_estimacion
    WHERE e2.id_proyecto = ? AND e2.numero < ?`, [idProyecto, numero]);
  return rows[0]?.acumulado_anterior || 0;
}

async function nextNumber(conn, idProyecto) {
  const rows = await query(
    'SELECT COALESCE(MAX(numero),0) as maxNum FROM ESTIMACION WHERE id_proyecto=?',
    [idProyecto],
    conn
  );
  return rows[0].maxNum + 1;
}

async function create(conn, { id_proyecto, numero, periodo_inicio, periodo_fin, fecha_presentacion, total, observaciones }) {
  return run(
    `INSERT INTO ESTIMACION (id_proyecto,numero,periodo_inicio,periodo_fin,fecha_presentacion,total_estimacion,observaciones)
     VALUES (?,?,?,?,?,?,?)`,
    [id_proyecto, numero, periodo_inicio, periodo_fin, fecha_presentacion, total, observaciones],
    conn
  );
}

async function createDetalle(conn, { id_estimacion, id_concepto, cantidad_periodo, precio_unitario }) {
  return run(
    'INSERT INTO DETALLE_ESTIMACION (id_estimacion,id_concepto,cantidad_periodo,precio_unitario) VALUES (?,?,?,?)',
    [id_estimacion, id_concepto, cantidad_periodo, precio_unitario],
    conn
  );
}

async function createGenerador(conn, { id_concepto, numero, periodo_fin, cantidad_periodo }) {
  return run(
    `INSERT INTO GENERADOR (id_concepto,numero_estimacion,descripcion,cantidad_periodo,fecha_generador) VALUES (?,?,?,?,?)`,
    [id_concepto, numero, `Estimación ${numero}`, cantidad_periodo, periodo_fin],
    conn
  );
}

async function updateEstado(id, estado) {
  return run('UPDATE ESTIMACION SET estado=? WHERE id_estimacion=?', [estado, id]);
}

async function acumuladoByProyecto(idProyecto) {
  return query(`
    SELECT e.numero, e.periodo_inicio, e.periodo_fin, e.estado,
      COALESCE(SUM(de.importe),0) as total_estimacion,
      SUM(SUM(de.importe)) OVER (ORDER BY e.numero) as acumulado
    FROM ESTIMACION e
    LEFT JOIN DETALLE_ESTIMACION de ON de.id_estimacion = e.id_estimacion
    WHERE e.id_proyecto = ?
    GROUP BY e.id_estimacion
    ORDER BY e.numero`, [idProyecto]);
}

async function findPresupuesto(idProyecto) {
  const rows = await query('SELECT presupuesto FROM PROYECTO WHERE id_proyecto=?', [idProyecto]);
  return rows[0] || null;
}

module.exports = {
  findByProyecto,
  findById,
  findDetalle,
  findAcumuladoAnterior,
  nextNumber,
  create,
  createDetalle,
  createGenerador,
  updateEstado,
  acumuladoByProyecto,
  findPresupuesto
};
