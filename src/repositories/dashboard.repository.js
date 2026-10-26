'use strict';

const { query } = require('./base.repository');

async function kpisProyectos() {
  const rows = await query(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN estado='activo' THEN 1 ELSE 0 END) as activos,
      SUM(CASE WHEN estado='finalizado' THEN 1 ELSE 0 END) as finalizados,
      SUM(CASE WHEN estado='activo' THEN presupuesto ELSE 0 END) as presupuesto_activos
    FROM PROYECTO`);
  return rows[0];
}

async function kpisGastos() {
  const rows = await query(`
    SELECT COALESCE(SUM(c.total_compra),0) as gasto_total
    FROM COMPRA c JOIN PROYECTO p ON p.id_proyecto=c.id_proyecto
    WHERE p.estado='activo'`);
  return rows[0];
}

async function kpisSalidas() {
  const rows = await query(`
    SELECT COUNT(*) as total_salidas,
      SUM(CASE WHEN tipo_salida='merma' THEN 1 ELSE 0 END) as mermas,
      SUM(CASE WHEN tipo_salida='robo'  THEN 1 ELSE 0 END) as robos
    FROM SALIDA`);
  return rows[0];
}

async function stockCritico() {
  return query(`
    SELECT descripcion, stock, unidades
    FROM PRODUCTO WHERE stock < 50 ORDER BY stock ASC LIMIT 6`);
}

async function alertasPrecio() {
  return query(`
    SELECT p.descripcion, c.precio_cotizado,
      ROUND(AVG(dc.precio_unitario_real),2) as precio_real,
      ROUND(((AVG(dc.precio_unitario_real)-c.precio_cotizado)/c.precio_cotizado)*100,1) as desviacion_pct
    FROM COTIZACION c
    JOIN PRODUCTO p ON p.id_producto=c.id_producto
    JOIN DETALLE_COMPRA dc ON dc.id_producto=p.id_producto
    GROUP BY p.id_producto, c.id_cotizacion
    HAVING desviacion_pct > 5
    ORDER BY desviacion_pct DESC LIMIT 5`);
}

async function avanceProyectos() {
  return query(`
    SELECT p.id_proyecto, p.nombre_obra, p.presupuesto, p.zona,
      p.porcentaje_avance, p.estado, p.fecha_inicio, p.fecha_fin_estimada,
      COALESCE(SUM(c.total_compra),0) as gasto_acumulado,
      (p.presupuesto - COALESCE(SUM(c.total_compra),0)) as saldo_restante,
      COALESCE(SUM(co.importe),0) as total_conceptos,
      COUNT(DISTINCT pa.id_partida) as num_partidas,
      COUNT(DISTINCT co.id_concepto) as num_conceptos,
      COALESCE(SUM(e.total_estimacion),0) as total_estimado
    FROM PROYECTO p
    LEFT JOIN COMPRA c   ON c.id_proyecto=p.id_proyecto
    LEFT JOIN PARTIDA pa ON pa.id_proyecto=p.id_proyecto
    LEFT JOIN CONCEPTO co ON co.id_partida=pa.id_partida
    LEFT JOIN ESTIMACION e ON e.id_proyecto=p.id_proyecto AND e.estado IN ('aprobada','pagada')
    GROUP BY p.id_proyecto
    ORDER BY p.estado='activo' DESC, p.fecha_inicio DESC`);
}

module.exports = {
  kpisProyectos,
  kpisGastos,
  kpisSalidas,
  stockCritico,
  alertasPrecio,
  avanceProyectos
};
