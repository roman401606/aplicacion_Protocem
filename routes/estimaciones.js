const express = require('express');
const router  = express.Router();
const { pool } = require('../db/database');
const { auth, requireRol } = require('../middleware/auth');

/* ── LISTAR ESTIMACIONES ── */
router.get('/proyecto/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.*,
        pr.nombre_obra,
        COUNT(de.id_det_est) as num_conceptos,
        COALESCE(SUM(de.importe),0) as total_calculado
      FROM ESTIMACION e
      JOIN PROYECTO pr ON pr.id_proyecto = e.id_proyecto
      LEFT JOIN DETALLE_ESTIMACION de ON de.id_estimacion = e.id_estimacion
      WHERE e.id_proyecto = ?
      GROUP BY e.id_estimacion
      ORDER BY e.numero DESC`, [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── DETALLE DE UNA ESTIMACIÓN ── */
router.get('/:id', auth, async (req, res) => {
  try {
    const [[est]] = await pool.query(`
      SELECT e.*, pr.nombre_obra, pr.zona
      FROM ESTIMACION e
      JOIN PROYECTO pr ON pr.id_proyecto = e.id_proyecto
      WHERE e.id_estimacion = ?`, [req.params.id]);
    if (!est) return res.status(404).json({ error: 'No encontrada' });

    const [detalle] = await pool.query(`
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
      ORDER BY pa.orden, co.orden`, [req.params.id]);

    /* acumulado anterior */
    const [acum] = await pool.query(`
      SELECT COALESCE(SUM(de2.importe),0) as acumulado_anterior
      FROM DETALLE_ESTIMACION de2
      JOIN ESTIMACION e2 ON e2.id_estimacion = de2.id_estimacion
      WHERE e2.id_proyecto = ? AND e2.numero < ?`, [est.id_proyecto, est.numero]);

    res.json({ estimacion: est, detalle, acumulado_anterior: acum[0]?.acumulado_anterior || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── CREAR ESTIMACIÓN ── */
router.post('/proyecto/:id', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { periodo_inicio, periodo_fin, fecha_presentacion, observaciones, items } = req.body;
  if (!periodo_inicio || !periodo_fin || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: 'Faltan datos' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    /* siguiente número de estimación */
    const [[{ maxNum }]] = await conn.query(
      `SELECT COALESCE(MAX(numero),0) as maxNum FROM ESTIMACION WHERE id_proyecto=?`, [req.params.id]);
    const numero = maxNum + 1;

    const total = items.reduce((s,i) => s + (i.cantidad_periodo * i.precio_unitario), 0);

    const [er] = await conn.query(
      `INSERT INTO ESTIMACION (id_proyecto,numero,periodo_inicio,periodo_fin,fecha_presentacion,total_estimacion,observaciones)
       VALUES (?,?,?,?,?,?,?)`,
      [req.params.id, numero, periodo_inicio, periodo_fin, fecha_presentacion||null, total, observaciones||null]);

    for (const it of items) {
      await conn.query(
        `INSERT INTO DETALLE_ESTIMACION (id_estimacion,id_concepto,cantidad_periodo,precio_unitario) VALUES (?,?,?,?)`,
        [er.insertId, it.id_concepto, it.cantidad_periodo, it.precio_unitario]);
      /* registrar en generador también */
      await conn.query(
        `INSERT INTO GENERADOR (id_concepto,numero_estimacion,descripcion,cantidad_periodo,fecha_generador) VALUES (?,?,?,?,?)`,
        [it.id_concepto, numero, `Estimación ${numero}`, it.cantidad_periodo, periodo_fin]);
    }

    await conn.commit();
    res.json({ id: er.insertId, numero, total, message: `Estimación ${numero} creada` });
  } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
  finally { conn.release(); }
});

/* ── CAMBIAR ESTADO DE ESTIMACIÓN ── */
router.put('/:id/estado', auth, requireRol('administrador'), async (req, res) => {
  const { estado } = req.body;
  const estados = ['borrador','presentada','aprobada','pagada'];
  if (!estados.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  try {
    await pool.query(`UPDATE ESTIMACION SET estado=? WHERE id_estimacion=?`, [estado, req.params.id]);
    res.json({ message: 'Estado actualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── RESUMEN ACUMULADO DE ESTIMACIONES POR PROYECTO ── */
router.get('/proyecto/:id/acumulado', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.numero, e.periodo_inicio, e.periodo_fin, e.estado,
        COALESCE(SUM(de.importe),0) as total_estimacion,
        SUM(SUM(de.importe)) OVER (ORDER BY e.numero) as acumulado
      FROM ESTIMACION e
      LEFT JOIN DETALLE_ESTIMACION de ON de.id_estimacion = e.id_estimacion
      WHERE e.id_proyecto = ?
      GROUP BY e.id_estimacion
      ORDER BY e.numero`, [req.params.id]);

    const [[proyecto]] = await pool.query(
      `SELECT presupuesto FROM PROYECTO WHERE id_proyecto=?`, [req.params.id]);

    const totalCobrado = rows.reduce((s,r) => s + parseFloat(r.total_estimacion||0), 0);

    res.json({ estimaciones: rows, presupuesto: proyecto?.presupuesto||0, total_cobrado: totalCobrado });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
