const express = require('express');
const router  = express.Router();
const { pool } = require('../db/database');
const { auth, requireRol } = require('../middleware/auth');

/* ── PARTIDAS ── */

router.get('/proyecto/:id', auth, async (req, res) => {
  try {
    const [partidas] = await pool.query(`
      SELECT pa.*,
        COUNT(co.id_concepto) as num_conceptos,
        COALESCE(SUM(co.importe),0) as total_partida
      FROM PARTIDA pa
      LEFT JOIN CONCEPTO co ON co.id_partida = pa.id_partida
      WHERE pa.id_proyecto = ?
      GROUP BY pa.id_partida
      ORDER BY pa.orden, pa.numero`, [req.params.id]);
    res.json(partidas);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/proyecto/:id', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { numero, nombre, descripcion, orden } = req.body;
  if (!numero || !nombre) return res.status(400).json({ error: 'numero y nombre son requeridos' });
  try {
    const [r] = await pool.query(
      `INSERT INTO PARTIDA (id_proyecto,numero,nombre,descripcion,orden) VALUES (?,?,?,?,?)`,
      [req.params.id, numero, nombre, descripcion||null, orden||0]);
    res.json({ id: r.insertId, message: 'Partida creada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id_partida', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { numero, nombre, descripcion, orden } = req.body;
  try {
    await pool.query(
      `UPDATE PARTIDA SET numero=COALESCE(?,numero), nombre=COALESCE(?,nombre),
       descripcion=COALESCE(?,descripcion), orden=COALESCE(?,orden)
       WHERE id_partida=?`,
      [numero||null, nombre||null, descripcion||null, orden??null, req.params.id_partida]);
    res.json({ message: 'Partida actualizada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id_partida', auth, requireRol('administrador'), async (req, res) => {
  try {
    await pool.query(`DELETE FROM PARTIDA WHERE id_partida=?`, [req.params.id_partida]);
    res.json({ message: 'Partida eliminada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── CONCEPTOS ── */

router.get('/:id_partida/conceptos', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT co.*,
        cc.fuente as cat_fuente, cc.especialidad as cat_especialidad,
        COALESCE(SUM(g.cantidad_periodo),0) as cantidad_ejecutada,
        ROUND((COALESCE(SUM(g.cantidad_periodo),0) / NULLIF(co.cantidad,0)) * 100, 2) as pct_ejecutado
      FROM CONCEPTO co
      LEFT JOIN CATALOGO_CONCEPTO cc ON cc.id_catalogo = co.id_catalogo
      LEFT JOIN GENERADOR g ON g.id_concepto = co.id_concepto
      WHERE co.id_partida = ?
      GROUP BY co.id_concepto
      ORDER BY co.orden`, [req.params.id_partida]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id_partida/conceptos', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { id_catalogo, clave, descripcion, unidad, cantidad, precio_unitario, orden } = req.body;
  if (!descripcion || !unidad || cantidad == null || precio_unitario == null)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  try {
    const [r] = await pool.query(
      `INSERT INTO CONCEPTO (id_partida,id_catalogo,clave,descripcion,unidad,cantidad,precio_unitario,orden) VALUES (?,?,?,?,?,?,?,?)`,
      [req.params.id_partida, id_catalogo||null, clave||null, descripcion, unidad, cantidad, precio_unitario, orden||0]);
    res.json({ id: r.insertId, message: 'Concepto creado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/conceptos/:id_concepto', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { clave, descripcion, unidad, cantidad, precio_unitario, orden } = req.body;
  try {
    await pool.query(
      `UPDATE CONCEPTO SET
        clave=COALESCE(?,clave), descripcion=COALESCE(?,descripcion),
        unidad=COALESCE(?,unidad), cantidad=COALESCE(?,cantidad),
        precio_unitario=COALESCE(?,precio_unitario), orden=COALESCE(?,orden)
       WHERE id_concepto=?`,
      [clave||null, descripcion||null, unidad||null, cantidad??null, precio_unitario??null, orden??null, req.params.id_concepto]);
    res.json({ message: 'Concepto actualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/conceptos/:id_concepto', auth, requireRol('administrador'), async (req, res) => {
  try {
    await pool.query(`DELETE FROM CONCEPTO WHERE id_concepto=?`, [req.params.id_concepto]);
    res.json({ message: 'Concepto eliminado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── APU — MATERIALES ── */

router.get('/conceptos/:id_concepto/apu', auth, async (req, res) => {
  try {
    const [[concepto]] = await pool.query(`
      SELECT co.*, pa.nombre as partida, pr.nombre_obra,
        SUM(am.importe) as total_materiales
      FROM CONCEPTO co
      JOIN PARTIDA pa ON pa.id_partida = co.id_partida
      JOIN PROYECTO pr ON pr.id_proyecto = pa.id_proyecto
      LEFT JOIN APU_MATERIAL am ON am.id_concepto = co.id_concepto
      WHERE co.id_concepto = ?
      GROUP BY co.id_concepto`, [req.params.id_concepto]);

    const [materiales]  = await pool.query(
      `SELECT am.*, p.descripcion as producto_nombre FROM APU_MATERIAL am
       LEFT JOIN PRODUCTO p ON p.id_producto = am.id_producto
       WHERE am.id_concepto=? ORDER BY am.id_apu_mat`, [req.params.id_concepto]);

    const [mano_obra]   = await pool.query(
      `SELECT mo.*, f.factor as fasar_factor FROM APU_MANO_OBRA mo
       LEFT JOIN FASAR f ON f.id_fasar = mo.id_fasar
       WHERE mo.id_concepto=? ORDER BY mo.id_apu_mo`, [req.params.id_concepto]);

    const [maquinaria]  = await pool.query(
      `SELECT * FROM APU_MAQUINARIA WHERE id_concepto=? ORDER BY id_apu_maq`, [req.params.id_concepto]);

    const totalMat  = materiales.reduce((s,r) => s + parseFloat(r.importe||0), 0);
    const totalMO   = mano_obra.reduce((s,r) => s + parseFloat(r.importe||0), 0);
    const totalMaq  = maquinaria.reduce((s,r) => s + parseFloat(r.importe||0), 0);
    const herramienta = totalMO * 0.03;
    const totalAPU  = totalMat + totalMO + totalMaq + herramienta;

    res.json({ concepto, materiales, mano_obra, maquinaria, totales: {
      materiales: totalMat, mano_obra: totalMO, maquinaria: totalMaq,
      herramienta, total_apu: totalAPU
    }});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/conceptos/:id_concepto/apu/material', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { id_producto, descripcion, unidad, cantidad, precio_unit } = req.body;
  if (!descripcion || !unidad || cantidad == null || precio_unit == null)
    return res.status(400).json({ error: 'Faltan campos' });
  try {
    const [r] = await pool.query(
      `INSERT INTO APU_MATERIAL (id_concepto,id_producto,descripcion,unidad,cantidad,precio_unit) VALUES (?,?,?,?,?,?)`,
      [req.params.id_concepto, id_producto||null, descripcion, unidad, cantidad, precio_unit]);
    res.json({ id: r.insertId, message: 'Material APU registrado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/conceptos/:id_concepto/apu/mano-obra', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { id_fasar, categoria, rendimiento, salario_real } = req.body;
  if (!categoria || rendimiento == null || salario_real == null)
    return res.status(400).json({ error: 'Faltan campos' });
  try {
    const [r] = await pool.query(
      `INSERT INTO APU_MANO_OBRA (id_concepto,id_fasar,categoria,rendimiento,salario_real) VALUES (?,?,?,?,?)`,
      [req.params.id_concepto, id_fasar||null, categoria, rendimiento, salario_real]);
    res.json({ id: r.insertId, message: 'Mano de obra APU registrada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/conceptos/:id_concepto/apu/maquinaria', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { descripcion, rendimiento, costo_hora } = req.body;
  if (!descripcion || rendimiento == null || costo_hora == null)
    return res.status(400).json({ error: 'Faltan campos' });
  try {
    const [r] = await pool.query(
      `INSERT INTO APU_MAQUINARIA (id_concepto,descripcion,rendimiento,costo_hora) VALUES (?,?,?,?)`,
      [req.params.id_concepto, descripcion, rendimiento, costo_hora]);
    res.json({ id: r.insertId, message: 'Maquinaria APU registrada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── GENERADORES DE CANTIDADES ── */

router.get('/conceptos/:id_concepto/generadores', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM GENERADOR WHERE id_concepto=? ORDER BY numero_estimacion, fecha_generador`,
      [req.params.id_concepto]);

    const [[resumen]] = await pool.query(`
      SELECT co.cantidad as cantidad_contratada,
        COALESCE(SUM(g.cantidad_periodo),0) as cantidad_ejecutada,
        (co.cantidad - COALESCE(SUM(g.cantidad_periodo),0)) as cantidad_por_ejecutar,
        ROUND((COALESCE(SUM(g.cantidad_periodo),0)/NULLIF(co.cantidad,0))*100,2) as pct_avance
      FROM CONCEPTO co LEFT JOIN GENERADOR g ON g.id_concepto=co.id_concepto
      WHERE co.id_concepto=? GROUP BY co.id_concepto`, [req.params.id_concepto]);

    res.json({ generadores: rows, resumen });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/conceptos/:id_concepto/generadores', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { numero_estimacion, descripcion, cantidad_periodo, fecha_generador } = req.body;
  if (!numero_estimacion || cantidad_periodo == null || !fecha_generador)
    return res.status(400).json({ error: 'Faltan campos' });
  try {
    const [r] = await pool.query(
      `INSERT INTO GENERADOR (id_concepto,numero_estimacion,descripcion,cantidad_periodo,fecha_generador) VALUES (?,?,?,?,?)`,
      [req.params.id_concepto, numero_estimacion, descripcion||null, cantidad_periodo, fecha_generador]);
    res.json({ id: r.insertId, message: 'Generador registrado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── EXPLOSIÓN DE INSUMOS ── */
router.get('/proyecto/:id/explosion', auth, async (req, res) => {
  try {
    const [materiales] = await pool.query(`
      SELECT am.descripcion, am.unidad, SUM(am.cantidad * co.cantidad) as cantidad_total,
        am.precio_unit, SUM(am.importe * co.cantidad / NULLIF(co.cantidad,0)) as importe_total,
        'Material' as tipo
      FROM APU_MATERIAL am
      JOIN CONCEPTO co ON co.id_concepto = am.id_concepto
      JOIN PARTIDA pa ON pa.id_partida = co.id_partida
      WHERE pa.id_proyecto = ?
      GROUP BY am.descripcion, am.unidad, am.precio_unit
      ORDER BY importe_total DESC`, [req.params.id]);

    const [mano_obra] = await pool.query(`
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
      ORDER BY importe_total DESC`, [req.params.id]);

    res.json({ materiales, mano_obra });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── RESUMEN PRESUPUESTO COMPLETO ── */
router.get('/proyecto/:id/resumen', auth, async (req, res) => {
  try {
    const [partidas] = await pool.query(`
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
      GROUP BY pa.id_partida ORDER BY pa.orden`, [req.params.id]);

    const [[totales]] = await pool.query(`
      SELECT pr.presupuesto,
        COALESCE(SUM(co.importe),0) as total_conceptos,
        COALESCE(SUM(cp.total_compra),0) as gasto_real
      FROM PROYECTO pr
      LEFT JOIN PARTIDA pa ON pa.id_proyecto = pr.id_proyecto
      LEFT JOIN CONCEPTO co ON co.id_partida = pa.id_partida
      LEFT JOIN COMPRA cp ON cp.id_proyecto = pr.id_proyecto
      WHERE pr.id_proyecto = ?
      GROUP BY pr.id_proyecto`, [req.params.id]);

    res.json({ partidas, totales });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
