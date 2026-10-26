const express = require('express');
const router  = express.Router();
const { pool } = require('../db/database');
const { auth, requireRol } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, u.nombre_usuario,
        COALESCE(SUM(c.total_compra),0) as gasto_acumulado,
        ROUND((COALESCE(SUM(c.total_compra),0)/p.presupuesto)*100,1) as pct_usado,
        (p.presupuesto - COALESCE(SUM(c.total_compra),0)) as saldo_restante
      FROM PROYECTO p
      LEFT JOIN USUARIO u ON u.id_usuario=p.id_usuario
      LEFT JOIN COMPRA c  ON c.id_proyecto=p.id_proyecto
      GROUP BY p.id_proyecto
      ORDER BY p.estado='activo' DESC, p.fecha_inicio DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const [[proy]] = await pool.query(`
      SELECT p.*, u.nombre_usuario,
        COALESCE(SUM(c.total_compra),0) as gasto_acumulado,
        (p.presupuesto - COALESCE(SUM(c.total_compra),0)) as saldo_restante
      FROM PROYECTO p
      LEFT JOIN USUARIO u ON u.id_usuario=p.id_usuario
      LEFT JOIN COMPRA c  ON c.id_proyecto=p.id_proyecto
      WHERE p.id_proyecto=? GROUP BY p.id_proyecto`, [req.params.id]);
    if (!proy) return res.status(404).json({ error: 'No encontrado' });
    const [compras] = await pool.query(`
      SELECT c.id_compra, c.fecha_compra, c.total_compra,
        GROUP_CONCAT(CONCAT(pr.descripcion,' x',dc.cantidad,' @ $',dc.precio_unitario_real) SEPARATOR ' | ') as detalle
      FROM COMPRA c
      LEFT JOIN DETALLE_COMPRA dc ON dc.id_compra=c.id_compra
      LEFT JOIN PRODUCTO pr ON pr.id_producto=dc.id_producto
      WHERE c.id_proyecto=? GROUP BY c.id_compra ORDER BY c.fecha_compra DESC LIMIT 10`, [req.params.id]);
    const [salidas] = await pool.query(`
      SELECT s.id_salida, s.fecha_salida, s.responsable, s.tipo_salida,
        GROUP_CONCAT(CONCAT(pr.descripcion,' x',ds.cantidad) SEPARATOR ' | ') as detalle
      FROM SALIDA s
      LEFT JOIN DETALLE_SALIDA ds ON ds.id_salida=s.id_salida
      LEFT JOIN PRODUCTO pr ON pr.id_producto=ds.id_producto
      WHERE s.id_proyecto=? GROUP BY s.id_salida ORDER BY s.fecha_salida DESC LIMIT 10`, [req.params.id]);
    res.json({ proyecto: proy, compras, salidas });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, requireRol('administrador'), async (req, res) => {
  const { nombre_obra, descripcion, fecha_inicio, fecha_fin_estimada, presupuesto, zona } = req.body;
  if (!nombre_obra || !fecha_inicio || !presupuesto)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  try {
    const [r] = await pool.query(
      `INSERT INTO PROYECTO (nombre_obra,descripcion,fecha_inicio,fecha_fin_estimada,presupuesto,zona,id_usuario) VALUES (?,?,?,?,?,?,?)`,
      [nombre_obra, descripcion||null, fecha_inicio, fecha_fin_estimada||null, presupuesto, zona||'Centro', req.user.id]);
    res.json({ id: r.insertId, message: 'Proyecto creado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/avance', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { porcentaje_avance, estado } = req.body;
  try {
    await pool.query(
      `UPDATE PROYECTO SET porcentaje_avance=?, estado=COALESCE(NULLIF(?,''),estado) WHERE id_proyecto=?`,
      [porcentaje_avance, estado||'', req.params.id]);
    res.json({ message: 'Avance actualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, requireRol('administrador'), async (req, res) => {
  try {
    const [[proy]] = await pool.query('SELECT nombre_obra FROM PROYECTO WHERE id_proyecto=?', [req.params.id]);
    if (!proy) return res.status(404).json({ error: 'Proyecto no encontrado' });
    await pool.query('DELETE FROM PROYECTO WHERE id_proyecto=?', [req.params.id]);
    res.json({ message: 'Proyecto eliminado', nombre_obra: proy.nombre_obra });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
