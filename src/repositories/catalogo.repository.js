'use strict';

const { query, run } = require('./base.repository');

async function find({ especialidad, zona, fuente, q, limit, offset, onlyWithPrice = false }) {
  let where = onlyWithPrice
    ? 'WHERE precio_ref IS NOT NULL AND precio_ref > 0'
    : 'WHERE 1=1';
  const vals = [];

  if (especialidad) {
    where += ' AND especialidad=?';
    vals.push(especialidad);
  }
  if (zona && zona !== 'Nacional') {
    where += " AND (zona=? OR zona='Nacional')";
    vals.push(zona);
  }
  if (fuente) {
    where += ' AND fuente=?';
    vals.push(fuente);
  }
  if (q) {
    where += ' AND (descripcion LIKE ? OR clave LIKE ?)';
    vals.push(`%${q}%`, `%${q}%`);
  }

  const countRows = await query(`SELECT COUNT(*) as total FROM CATALOGO_CONCEPTO ${where}`, vals);
  const rows = onlyWithPrice
    ? await query(
        `SELECT clave, descripcion, unidad, precio_ref, especialidad, fuente, año_catalogo
         FROM CATALOGO_CONCEPTO ${where}
         ORDER BY especialidad, clave LIMIT ? OFFSET ?`,
        [...vals, limit, offset]
      )
    : await query(
        `SELECT * FROM CATALOGO_CONCEPTO ${where} ORDER BY especialidad, clave LIMIT ? OFFSET ?`,
        [...vals, limit, offset]
      );

  return { rows, total: countRows[0]?.total || 0 };
}

async function especialidades() {
  return query(`
    SELECT DISTINCT especialidad, COUNT(*) as num_conceptos
    FROM CATALOGO_CONCEPTO GROUP BY especialidad ORDER BY especialidad`);
}

async function fasar(zona) {
  let sql = 'SELECT * FROM FASAR WHERE 1=1';
  const vals = [];
  if (zona) {
    sql += ' AND zona=?';
    vals.push(zona);
  }
  sql += ' ORDER BY zona, salario_base';
  return query(sql, vals);
}

async function create({ clave, descripcion, unidad, precio_ref, especialidad, fuente, año_catalogo, zona }) {
  return run(
    `INSERT INTO CATALOGO_CONCEPTO (clave,descripcion,unidad,precio_ref,especialidad,fuente,año_catalogo,zona)
     VALUES (?,?,?,?,?,?,?,?)`,
    [clave, descripcion, unidad, precio_ref, especialidad, fuente, año_catalogo, zona]
  );
}

async function update(id, { precio_ref, descripcion, año_catalogo }) {
  return run(
    `UPDATE CATALOGO_CONCEPTO SET
      precio_ref=COALESCE(?,precio_ref),
      descripcion=COALESCE(?,descripcion),
      año_catalogo=COALESCE(?,año_catalogo)
     WHERE id_catalogo=?`,
    [precio_ref, descripcion, año_catalogo, id]
  );
}

module.exports = { find, especialidades, fasar, create, update };
