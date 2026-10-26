const express = require('express');
const router  = express.Router();
const { pool } = require('../db/database');
const { auth, requireRol } = require('../middleware/auth');

router.get('/compras', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id_compra, c.fecha_compra, c.total_compra, p.nombre_obra,
        GROUP_CONCAT(CONCAT(pr.descripcion,' x',dc.cantidad,' @ $',dc.precio_unitario_real) ORDER BY dc.id_detalle SEPARATOR ' | ') as detalle
      FROM COMPRA c JOIN PROYECTO p ON p.id_proyecto=c.id_proyecto
      LEFT JOIN DETALLE_COMPRA dc ON dc.id_compra=c.id_compra
      LEFT JOIN PRODUCTO pr ON pr.id_producto=dc.id_producto
      GROUP BY c.id_compra ORDER BY c.fecha_compra DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/compras', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { id_proyecto, fecha_compra, items } = req.body;
  if (!id_proyecto || !fecha_compra || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: 'Faltan datos' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const total = items.reduce((s,i) => s + i.cantidad * i.precio_unitario_real, 0);
    const [cr]  = await conn.query(`INSERT INTO COMPRA (fecha_compra,total_compra,id_proyecto) VALUES (?,?,?)`, [fecha_compra,total,id_proyecto]);
    for (const it of items) {
      await conn.query(`INSERT INTO DETALLE_COMPRA (id_compra,id_producto,cantidad,precio_unitario_real) VALUES (?,?,?,?)`, [cr.insertId,it.id_producto,it.cantidad,it.precio_unitario_real]);
      await conn.query(`UPDATE PRODUCTO SET stock=stock+? WHERE id_producto=?`, [it.cantidad,it.id_producto]);
    }
    await conn.commit();
    res.json({ id: cr.insertId, total, message: 'Compra registrada' });
  } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
  finally { conn.release(); }
});

router.get('/salidas', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.id_salida, s.fecha_salida, s.responsable, s.tipo_salida, s.total_salida, p.nombre_obra,
        GROUP_CONCAT(CONCAT(pr.descripcion,' x',ds.cantidad) ORDER BY ds.id_detalle_salida SEPARATOR ' | ') as detalle
      FROM SALIDA s JOIN PROYECTO p ON p.id_proyecto=s.id_proyecto
      LEFT JOIN DETALLE_SALIDA ds ON ds.id_salida=s.id_salida
      LEFT JOIN PRODUCTO pr ON pr.id_producto=ds.id_producto
      GROUP BY s.id_salida ORDER BY s.fecha_salida DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/salidas', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { id_proyecto, fecha_salida, responsable, tipo_salida, items } = req.body;
  if (!id_proyecto || !fecha_salida || !responsable || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: 'Faltan datos' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [sr] = await conn.query(`INSERT INTO SALIDA (fecha_salida,responsable,tipo_salida,id_proyecto) VALUES (?,?,?,?)`, [fecha_salida,responsable,tipo_salida||'consumo',id_proyecto]);
    for (const it of items) {
      await conn.query(`INSERT INTO DETALLE_SALIDA (id_salida,id_producto,cantidad) VALUES (?,?,?)`, [sr.insertId,it.id_producto,it.cantidad]);
      await conn.query(`UPDATE PRODUCTO SET stock=GREATEST(0,stock-?) WHERE id_producto=?`, [it.cantidad,it.id_producto]);
    }
    await conn.commit();
    res.json({ id: sr.insertId, message: 'Salida registrada' });
  } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
  finally { conn.release(); }
});

router.get('/productos', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*,
        (SELECT MAX(dc.precio_unitario_real) FROM DETALLE_COMPRA dc WHERE dc.id_producto=p.id_producto) as precio_ultimo_real,
        (SELECT MAX(co.precio_cotizado) FROM COTIZACION co WHERE co.id_producto=p.id_producto) as precio_cotizado_ref
      FROM PRODUCTO p ORDER BY p.tipo_producto, p.descripcion`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/productos', auth, requireRol('administrador'), async (req, res) => {
  const { descripcion, tipo_producto, unidades, precio_referencia } = req.body;
  if (!descripcion || !unidades) return res.status(400).json({ error: 'Faltan campos' });
  try {
    const [r] = await pool.query(`INSERT INTO PRODUCTO (descripcion,tipo_producto,unidades,precio_referencia) VALUES (?,?,?,?)`, [descripcion,tipo_producto||null,unidades,precio_referencia||null]);
    res.json({ id: r.insertId, message: 'Producto creado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/cotizaciones/catalogo', auth, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 200, 500);
  const offset = Math.max(parseInt(req.query.offset) || 0,   0);
  const { especialidad, fuente, q } = req.query;
  try {
    let where = `WHERE precio_ref IS NOT NULL AND precio_ref > 0`;
    const vals = [];
    if (especialidad) { where += ` AND especialidad=?`; vals.push(especialidad); }
    if (fuente)       { where += ` AND fuente=?`;       vals.push(fuente); }
    if (q)            { where += ` AND (descripcion LIKE ? OR clave LIKE ?)`; vals.push(`%${q}%`, `%${q}%`); }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM CATALOGO_CONCEPTO ${where}`, vals);
    const [rows] = await pool.query(
      `SELECT clave, descripcion, unidad, precio_ref, especialidad, fuente, año_catalogo
       FROM CATALOGO_CONCEPTO ${where}
       ORDER BY especialidad, clave LIMIT ? OFFSET ?`,
      [...vals, limit, offset]);
    res.json({ rows, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/cotizaciones', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT co.*, pr.descripcion as producto, pr.unidades, pv.nombre as proveedor, pv.empresa,
        ROUND((SELECT AVG(dc.precio_unitario_real) FROM DETALLE_COMPRA dc WHERE dc.id_producto=co.id_producto),2) as precio_real_promedio,
        ROUND(((SELECT AVG(dc.precio_unitario_real) FROM DETALLE_COMPRA dc WHERE dc.id_producto=co.id_producto)-co.precio_cotizado)/co.precio_cotizado*100,1) as desviacion_pct
      FROM COTIZACION co
      JOIN PRODUCTO pr ON pr.id_producto=co.id_producto
      JOIN PROVEEDOR pv ON pv.id_proveedor=co.id_proveedor
      ORDER BY co.fecha_cotizacion DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/cotizaciones', auth, requireRol('administrador','encargado'), async (req, res) => {
  const { id_producto, id_proveedor, fecha_cotizacion, precio_cotizado } = req.body;
  if (!id_producto || !id_proveedor || !fecha_cotizacion || !precio_cotizado)
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  try {
    const [r] = await pool.query(`INSERT INTO COTIZACION (fecha_cotizacion,precio_cotizado,id_producto,id_proveedor) VALUES (?,?,?,?)`, [fecha_cotizacion,precio_cotizado,id_producto,id_proveedor]);
    res.json({ id: r.insertId, message: 'Cotizacion registrada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/proveedores', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM PROVEEDOR ORDER BY nombre`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/proveedores', auth, requireRol('administrador'), async (req, res) => {
  const { nombre, empresa, telefono, contacto } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });
  try {
    const [r] = await pool.query(`INSERT INTO PROVEEDOR (nombre,empresa,telefono,contacto) VALUES (?,?,?,?)`, [nombre,empresa||null,telefono||null,contacto||null]);
    res.json({ id: r.insertId, message: 'Proveedor creado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/usuarios', auth, requireRol('administrador'), async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT id_usuario,nombre_usuario,correo,rol,activo FROM USUARIO ORDER BY nombre_usuario`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/usuarios', auth, requireRol('administrador'), async (req, res) => {
  const { nombre_usuario, correo, rol, contrasena } = req.body;
  if (!nombre_usuario || !correo || !rol || !contrasena)
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  try {
    const bcrypt = require('bcryptjs');
    const hash   = await bcrypt.hash(contrasena, 10);
    const [r]    = await pool.query(`INSERT INTO USUARIO (nombre_usuario,correo,rol,contrasena_hash) VALUES (?,?,?,?)`, [nombre_usuario,correo,rol,hash]);
    res.json({ id: r.insertId, message: 'Usuario creado' });
  } catch (e) {
    if (e.code==='ER_DUP_ENTRY') return res.status(400).json({ error: 'El correo ya existe' });
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
