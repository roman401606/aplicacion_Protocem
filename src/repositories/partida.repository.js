'use strict';

const { query, run } = require('./base.repository');

async function findByProyecto(idProyecto) {
  return query(`
    SELECT pa.*,
      COUNT(co.id_concepto) as num_conceptos,
      COALESCE(SUM(co.importe),0) as total_partida
    FROM PARTIDA pa
    LEFT JOIN CONCEPTO co ON co.id_partida = pa.id_partida
    WHERE pa.id_proyecto = ?
    GROUP BY pa.id_partida
    ORDER BY pa.orden, pa.numero`, [idProyecto]);
}

async function create(idProyecto, { numero, nombre, descripcion, orden }) {
  return run(
    `INSERT INTO PARTIDA (id_proyecto,numero,nombre,descripcion,orden) VALUES (?,?,?,?,?)`,
    [idProyecto, numero, nombre, descripcion, orden]
  );
}

async function update(idPartida, { numero, nombre, descripcion, orden }) {
  return run(
    `UPDATE PARTIDA SET numero=COALESCE(?,numero), nombre=COALESCE(?,nombre),
     descripcion=COALESCE(?,descripcion), orden=COALESCE(?,orden)
     WHERE id_partida=?`,
    [numero, nombre, descripcion, orden, idPartida]
  );
}

async function remove(idPartida) {
  return run('DELETE FROM PARTIDA WHERE id_partida=?', [idPartida]);
}

async function findConceptos(idPartida) {
  return query(`
    SELECT co.*,
      cc.fuente as cat_fuente, cc.especialidad as cat_especialidad,
      COALESCE(SUM(g.cantidad_periodo),0) as cantidad_ejecutada,
      ROUND((COALESCE(SUM(g.cantidad_periodo),0) / NULLIF(co.cantidad,0)) * 100, 2) as pct_ejecutado
    FROM CONCEPTO co
    LEFT JOIN CATALOGO_CONCEPTO cc ON cc.id_catalogo = co.id_catalogo
    LEFT JOIN GENERADOR g ON g.id_concepto = co.id_concepto
    WHERE co.id_partida = ?
    GROUP BY co.id_concepto
    ORDER BY co.orden`, [idPartida]);
}

async function createConcepto(idPartida, { id_catalogo, clave, descripcion, unidad, cantidad, precio_unitario, orden }) {
  return run(
    `INSERT INTO CONCEPTO (id_partida,id_catalogo,clave,descripcion,unidad,cantidad,precio_unitario,orden) VALUES (?,?,?,?,?,?,?,?)`,
    [idPartida, id_catalogo, clave, descripcion, unidad, cantidad, precio_unitario, orden]
  );
}

async function updateConcepto(idConcepto, { clave, descripcion, unidad, cantidad, precio_unitario, orden }) {
  return run(
    `UPDATE CONCEPTO SET
      clave=COALESCE(?,clave), descripcion=COALESCE(?,descripcion),
      unidad=COALESCE(?,unidad), cantidad=COALESCE(?,cantidad),
      precio_unitario=COALESCE(?,precio_unitario), orden=COALESCE(?,orden)
     WHERE id_concepto=?`,
    [clave, descripcion, unidad, cantidad, precio_unitario, orden, idConcepto]
  );
}

async function removeConcepto(idConcepto) {
  return run('DELETE FROM CONCEPTO WHERE id_concepto=?', [idConcepto]);
}

async function findApuConcepto(idConcepto) {
  const rows = await query(`
    SELECT co.*, pa.nombre as partida, pr.nombre_obra,
      SUM(am.importe) as total_materiales
    FROM CONCEPTO co
    JOIN PARTIDA pa ON pa.id_partida = co.id_partida
    JOIN PROYECTO pr ON pr.id_proyecto = pa.id_proyecto
    LEFT JOIN APU_MATERIAL am ON am.id_concepto = co.id_concepto
    WHERE co.id_concepto = ?
    GROUP BY co.id_concepto`, [idConcepto]);
  return rows[0] || null;
}

async function findApuMateriales(idConcepto) {
  return query(
    `SELECT am.*, p.descripcion as producto_nombre FROM APU_MATERIAL am
     LEFT JOIN PRODUCTO p ON p.id_producto = am.id_producto
     WHERE am.id_concepto=? ORDER BY am.id_apu_mat`, [idConcepto]);
}

async function findApuManoObra(idConcepto) {
  return query(
    `SELECT mo.*, f.factor as fasar_factor FROM APU_MANO_OBRA mo
     LEFT JOIN FASAR f ON f.id_fasar = mo.id_fasar
     WHERE mo.id_concepto=? ORDER BY mo.id_apu_mo`, [idConcepto]);
}

async function findApuMaquinaria(idConcepto) {
  return query(
    'SELECT * FROM APU_MAQUINARIA WHERE id_concepto=? ORDER BY id_apu_maq',
    [idConcepto]
  );
}

async function createApuMaterial(idConcepto, { id_producto, descripcion, unidad, cantidad, precio_unit }) {
  return run(
    `INSERT INTO APU_MATERIAL (id_concepto,id_producto,descripcion,unidad,cantidad,precio_unit) VALUES (?,?,?,?,?,?)`,
    [idConcepto, id_producto, descripcion, unidad, cantidad, precio_unit]
  );
}

async function createApuManoObra(idConcepto, { id_fasar, categoria, rendimiento, salario_real }) {
  return run(
    `INSERT INTO APU_MANO_OBRA (id_concepto,id_fasar,categoria,rendimiento,salario_real) VALUES (?,?,?,?,?)`,
    [idConcepto, id_fasar, categoria, rendimiento, salario_real]
  );
}

async function createApuMaquinaria(idConcepto, { descripcion, rendimiento, costo_hora }) {
  return run(
    `INSERT INTO APU_MAQUINARIA (id_concepto,descripcion,rendimiento,costo_hora) VALUES (?,?,?,?)`,
    [idConcepto, descripcion, rendimiento, costo_hora]
  );
}

async function findGeneradores(idConcepto) {
  return query(
    'SELECT * FROM GENERADOR WHERE id_concepto=? ORDER BY numero_estimacion, fecha_generador',
    [idConcepto]
  );
}

async function resumenGeneradores(idConcepto) {
  const rows = await query(`
    SELECT co.cantidad as cantidad_contratada,
      COALESCE(SUM(g.cantidad_periodo),0) as cantidad_ejecutada,
      (co.cantidad - COALESCE(SUM(g.cantidad_periodo),0)) as cantidad_por_ejecutar,
      ROUND((COALESCE(SUM(g.cantidad_periodo),0)/NULLIF(co.cantidad,0))*100,2) as pct_avance
    FROM CONCEPTO co LEFT JOIN GENERADOR g ON g.id_concepto=co.id_concepto
    WHERE co.id_concepto=? GROUP BY co.id_concepto`, [idConcepto]);
  return rows[0] || null;
}

async function createGenerador(idConcepto, { numero_estimacion, descripcion, cantidad_periodo, fecha_generador }) {
  return run(
    `INSERT INTO GENERADOR (id_concepto,numero_estimacion,descripcion,cantidad_periodo,fecha_generador) VALUES (?,?,?,?,?)`,
    [idConcepto, numero_estimacion, descripcion, cantidad_periodo, fecha_generador]
  );
}

async function explosionMateriales(idProyecto) {
  return query(`
    SELECT am.descripcion, am.unidad, SUM(am.cantidad * co.cantidad) as cantidad_total,
      am.precio_unit, SUM(am.importe * co.cantidad / NULLIF(co.cantidad,0)) as importe_total,
      'Material' as tipo
    FROM APU_MATERIAL am
    JOIN CONCEPTO co ON co.id_concepto = am.id_concepto
    JOIN PARTIDA pa ON pa.id_partida = co.id_partida
    WHERE pa.id_proyecto = ?
    GROUP BY am.descripcion, am.unidad, am.precio_unit
    ORDER BY importe_total DESC`, [idProyecto]);
}

async function explosionManoObra(idProyecto) {
  return query(`
    SELECT mo.categoria as descripcion, 'jornal' as unidad,
      SUM(mo.rendimiento * co.cantidad) as cantidad_total,
      mo.salario_real as precio_unit,
      SUM(mo.importe * co.cantidad / NULLIF(co.cantidad,0)) as importe_total,
      'Mano de Obra' as tipo
    FROM APU_MANO_OBRA mo
    JOIN CONCEPTO co ON co.id_concepto = mo.id_concepto
    JOIN PARTIDA pa ON pa.id_partida = co.id_partida
    WHERE pa.id_proyecto = ?
    GROUP BY mo.categoria, mo.salario_real
    ORDER BY importe_total DESC`, [idProyecto]);
}

async function resumenPartidas(idProyecto) {
  return query(`
    SELECT pa.id_partida, pa.numero, pa.nombre, pa.orden,
      COUNT(DISTINCT co.id_concepto) as num_conceptos,
      COALESCE(SUM(co.importe),0) as total_partida,
      COALESCE(SUM(co.importe * COALESCE(ge.pct,0)/100),0) as avance_financiero,
      COALESCE(SUM(cg.gasto),0) as gasto_real
    FROM PARTIDA pa
    LEFT JOIN CONCEPTO co ON co.id_partida = pa.id_partida
    LEFT JOIN (
      SELECT id_concepto, SUM(total_compra) as gasto FROM COMPRA
      WHERE id_concepto IS NOT NULL GROUP BY id_concepto
    ) cg ON cg.id_concepto = co.id_concepto
    LEFT JOIN (
      SELECT g.id_concepto, ROUND(SUM(g.cantidad_periodo)/NULLIF(MAX(c2.cantidad),0)*100,2) as pct
      FROM GENERADOR g
      JOIN CONCEPTO c2 ON c2.id_concepto = g.id_concepto
      GROUP BY g.id_concepto
    ) ge ON ge.id_concepto = co.id_concepto
    WHERE pa.id_proyecto = ?
    GROUP BY pa.id_partida ORDER BY pa.orden`, [idProyecto]);
}

async function resumenTotales(idProyecto) {
  const rows = await query(`
    SELECT pr.presupuesto,
      COALESCE(SUM(co.importe),0) as total_conceptos,
      COALESCE(SUM(cp.total_compra),0) as gasto_real
    FROM PROYECTO pr
    LEFT JOIN PARTIDA pa ON pa.id_proyecto = pr.id_proyecto
    LEFT JOIN CONCEPTO co ON co.id_partida = pa.id_partida
    LEFT JOIN COMPRA cp ON cp.id_proyecto = pr.id_proyecto
    WHERE pr.id_proyecto = ?
    GROUP BY pr.id_proyecto`, [idProyecto]);
  return rows[0] || null;
}

module.exports = {
  findByProyecto,
  create,
  update,
  remove,
  findConceptos,
  createConcepto,
  updateConcepto,
  removeConcepto,
  findApuConcepto,
  findApuMateriales,
  findApuManoObra,
  findApuMaquinaria,
  createApuMaterial,
  createApuManoObra,
  createApuMaquinaria,
  findGeneradores,
  resumenGeneradores,
  createGenerador,
  explosionMateriales,
  explosionManoObra,
  resumenPartidas,
  resumenTotales
};
