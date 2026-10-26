'use strict';

const { query, run } = require('./base.repository');

async function findAll() {
  return query('SELECT * FROM PROVEEDOR ORDER BY nombre');
}

async function findById(id) {
  const rows = await query('SELECT * FROM PROVEEDOR WHERE id_proveedor=?', [id]);
  return rows[0] || null;
}

async function create({ nombre, empresa, telefono, contacto }) {
  return run(
    'INSERT INTO PROVEEDOR (nombre,empresa,telefono,contacto) VALUES (?,?,?,?)',
    [nombre, empresa, telefono, contacto]
  );
}

module.exports = { findAll, findById, create };
