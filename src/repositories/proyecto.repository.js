'use strict';

const { query, run } = require('./base.repository');

async function findAll() {
  return query(`
    SELECT p.*, u.nombre_usuario,
      COALESCE(SUM(c.total_compra),0) as gasto_acumulado,
      ROUND((COALESCE(SUM(c.total_compra),0)/p.presupuesto)*100,1) as pct_usado,
      (p.presupuesto - COALESCE(SUM(c.total_compra),0)) as saldo_restante
    FROM PROYECTO p
    LEFT JOIN USUARIO u ON u.id_usuario=p.id_usuario
    LEFT JOIN COMPRA c  ON c.id_proyecto=p.id_proyecto
    GROUP BY p.id_proyecto
    ORDER BY p.estado='activo' DESC, p.fecha_inicio DESC`);
}

async function findById(id) {
  const rows = await query(`
    SELECT p.*, u.nombre_usuario,
      COALESCE(SUM(c.total_compra),0) as gasto_acumulado,
      (p.presupuesto - COALESCE(SUM(c.total_compra),0)) as saldo_restante
    FROM PROYECTO p
    LEFT JOIN USUARIO u ON u.id_usuario=p.id_usuario
    LEFT JOIN COMPRA c  ON c.id_proyecto=p.id_proyecto
    WHERE p.id_proyecto=? GROUP BY p.id_proyecto`, [id]);
  return rows[0] || null;
}

async function findCompras(id) {
  return query(`
    SELECT c.id_compra, c.fecha_compra, c.total_compra,
      GROUP_CONCAT(CONCAT(pr.descripcion,' x',dc.cantidad,' @ $',dc.precio_unitario_real) SEPARATOR ' | ') as detalle
    FROM COMPRA c
    LEFT JOIN DETALLE_COMPRA dc ON dc.id_compra=c.id_compra
    LEFT JOIN PRODUCTO pr ON pr.id_producto=dc.id_producto
    WHERE c.id_proyecto=? GROUP BY c.id_compra ORDER BY c.fecha_compra DESC LIMIT 10`, [id]);
}

async function findSalidas(id) {
  return query(`
    SELECT s.id_salida, s.fecha_salida, s.responsable, s.tipo_salida,
      GROUP_CONCAT(CONCAT(pr.descripcion,' x',ds.cantidad) SEPARATOR ' | ') as detalle
    FROM SALIDA s
    LEFT JOIN DETALLE_SALIDA ds ON ds.id_salida=s.id_salida
    LEFT JOIN PRODUCTO pr ON pr.id_producto=ds.id_producto
    WHERE s.id_proyecto=? GROUP BY s.id_salida ORDER BY s.fecha_salida DESC LIMIT 10`, [id]);
}

async function findNombre(id) {
  const rows = await query('SELECT nombre_obra FROM PROYECTO WHERE id_proyecto=?', [id]);
  return rows[0] || null;
}

async function create({ nombre_obra, descripcion, fecha_inicio, fecha_fin_estimada, presupuesto, zona, id_usuario }) {
  return run(
    `INSERT INTO PROYECTO (nombre_obra,descripcion,fecha_inicio,fecha_fin_estimada,presupuesto,zona,id_usuario) VALUES (?,?,?,?,?,?,?)`,
    [nombre_obra, descripcion, fecha_inicio, fecha_fin_estimada, presupuesto, zona, id_usuario]
  );
}

async function updateAvance(id, { porcentaje_avance, estado }) {
  return run(
    `UPDATE PROYECTO SET porcentaje_avance=?, estado=COALESCE(NULLIF(?,''),estado) WHERE id_proyecto=?`,
    [porcentaje_avance, estado, id]
  );
}

async function remove(id) {
  return run('DELETE FROM PROYECTO WHERE id_proyecto=?', [id]);
}

module.exports = {
  findAll,
  findById,
  findCompras,
  findSalidas,
  findNombre,
  create,
  updateAvance,
  remove
};
