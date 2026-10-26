const express = require('express');
const router  = express.Router();
const { pool } = require('../db/database');
const { auth, requireRol } = require('../middleware/auth');

/* ── LISTAR CATÁLOGO CON FILTROS Y PAGINACIÓN ── */
router.get('/', auth, async (req, res) => {
  const { especialidad, zona, fuente, q } = req.query;
  const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
  const offset = Math.max(parseInt(req.query.offset) || 0,   0);
  try {
    let where = `WHERE 1=1`;
    const vals = [];
    if (especialidad) { where += ` AND especialidad=?`; vals.push(especialidad); }
    if (zona && zona !== 'Nacional') { where += ` AND (zona=? OR zona='Nacional')`; vals.push(zona); }
    if (fuente)       { where += ` AND fuente=?`; vals.push(fuente); }
    if (q)            { where += ` AND (descripcion LIKE ? OR clave LIKE ?)`; vals.push(`%${q}%`,`%${q}%`); }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM CATALOGO_CONCEPTO ${where}`, vals);
    const [rows] = await pool.query(
      `SELECT * FROM CATALOGO_CONCEPTO ${where} ORDER BY especialidad, clave LIMIT ? OFFSET ?`,
      [...vals, limit, offset]);
    res.json({ rows, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── ESPECIALIDADES DISPONIBLES ── */
router.get('/especialidades', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT especialidad, COUNT(*) as num_conceptos
       FROM CATALOGO_CONCEPTO GROUP BY especialidad ORDER BY especialidad`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── FASAR (Factores de Salario Real) ── */
router.get('/fasar', auth, async (req, res) => {
  const { zona } = req.query;
  try {
    let sql = `SELECT * FROM FASAR WHERE 1=1`;
    const vals = [];
    if (zona) { sql += ` AND zona=?`; vals.push(zona); }
    sql += ` ORDER BY zona, salario_base`;
    const [rows] = await pool.query(sql, vals);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── AGREGAR CONCEPTO AL CATÁLOGO ── */
router.post('/', auth, requireRol('administrador'), async (req, res) => {
  const { clave, descripcion, unidad, precio_ref, especialidad, fuente, año_catalogo, zona } = req.body;
  if (!clave || !descripcion || !unidad || !especialidad)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  try {
    const [r] = await pool.query(
      `INSERT INTO CATALOGO_CONCEPTO (clave,descripcion,unidad,precio_ref,especialidad,fuente,año_catalogo,zona)
       VALUES (?,?,?,?,?,?,?,?)`,
      [clave, descripcion, unidad, precio_ref||null, especialidad, fuente||'Libre', año_catalogo||2025, zona||'Nacional']);
    res.json({ id: r.insertId, message: 'Concepto agregado al catálogo' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── ACTUALIZAR PRECIO DE REFERENCIA ── */
router.put('/:id', auth, requireRol('administrador'), async (req, res) => {
  const { precio_ref, descripcion, año_catalogo } = req.body;
  try {
    await pool.query(
      `UPDATE CATALOGO_CONCEPTO SET
        precio_ref=COALESCE(?,precio_ref),
        descripcion=COALESCE(?,descripcion),
        año_catalogo=COALESCE(?,año_catalogo)
       WHERE id_catalogo=?`,
      [precio_ref??null, descripcion||null, año_catalogo||null, req.params.id]);
    res.json({ message: 'Actualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
