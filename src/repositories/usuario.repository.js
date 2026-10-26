'use strict';

const { query, run } = require('./base.repository');

async function findByCorreo(correo) {
  const rows = await query('SELECT * FROM USUARIO WHERE correo=? AND activo=1', [correo]);
  return rows[0] || null;
}

async function findAll() {
  return query(
    `SELECT id_usuario,nombre_usuario,correo,rol,activo
     FROM USUARIO ORDER BY nombre_usuario`
  );
}

async function create({ nombre_usuario, correo, rol, contrasena_hash }) {
  return run(
    `INSERT INTO USUARIO (nombre_usuario,correo,rol,contrasena_hash) VALUES (?,?,?,?)`,
    [nombre_usuario, correo, rol, contrasena_hash]
  );
}

module.exports = { findByCorreo, findAll, create };
