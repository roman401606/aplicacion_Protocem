const express = require('express');
const router  = express.Router();
const { pool } = require('../db/database');
const { auth } = require('../middleware/auth');

router.get('/kpis', auth, async (req, res) => {
  try {
    const [[proyectos]] = await pool.query(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN estado='activo' THEN 1 ELSE 0 END) as activos,
        SUM(CASE WHEN estado='finalizado' THEN 1 ELSE 0 END) as finalizados,
        SUM(CASE WHEN estado='activo' THEN presupuesto ELSE 0 END) as presupuesto_activos
      FROM PROYECTO`);
    const [[gastos]] = await pool.query(`
      SELECT COALESCE(SUM(c.total_compra),0) as gasto_total
      FROM COMPRA c JOIN PROYECTO p ON p.id_proyecto=c.id_proyecto
      WHERE p.estado='activo'`);
    const [[salidas]] = await pool.query(`
      SELECT COUNT(*) as total_salidas,
        SUM(CASE WHEN tipo_salida='merma' THEN 1 ELSE 0 END) as mermas,
        SUM(CASE WHEN tipo_salida='robo'  THEN 1 ELSE 0 END) as robos
      FROM SALIDA`);
    const [stock_critico] = await pool.query(`
      SELECT descripcion, stock, unidades
      FROM PRODUCTO WHERE stock < 50 ORDER BY stock ASC LIMIT 6`);
    const [alertas_precio] = await pool.query(`
      SELECT p.descripcion, c.precio_cotizado,
        ROUND(AVG(dc.precio_unitario_real),2) as precio_real,
        ROUND(((AVG(dc.precio_unitario_real)-c.precio_cotizado)/c.precio_cotizado)*100,1) as desviacion_pct
      FROM COTIZACION c
      JOIN PRODUCTO p ON p.id_producto=c.id_producto
      JOIN DETALLE_COMPRA dc ON dc.id_producto=p.id_producto
      GROUP BY p.id_producto, c.id_cotizacion
      HAVING desviacion_pct > 5
      ORDER BY desviacion_pct DESC LIMIT 5`);
    const [avance_proyectos] = await pool.query(`
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

    /* semáforo: compara gasto real vs. presupuesto */
    avance_proyectos.forEach(p => {
      const pct = p.presupuesto > 0 ? (p.gasto_acumulado / p.presupuesto) * 100 : 0;
      p.semaforo = pct > 90 ? 'rojo' : pct > 70 ? 'amarillo' : 'verde';
      p.pct_gastado = parseFloat(pct.toFixed(1));
    });

    res.json({ proyectos, gastos, salidas, stock_critico, alertas_precio, avance_proyectos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
