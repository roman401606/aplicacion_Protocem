'use strict';

const { pool } = require('../config/database');

/**
 * Ejecuta una consulta y devuelve las filas.
 * `conn` permite participar en una transaccion abierta por un service.
 */
async function query(sql, params = [], conn = pool) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

/**
 * Ejecuta una sentencia y devuelve el resultado crudo de MySQL
 * (insertId, affectedRows, etc.).
 */
async function run(sql, params = [], conn = pool) {
  const [result] = await conn.query(sql, params);
  return result;
}

/**
 * Ejecuta un bloque dentro de una transaccion.
 * El callback recibe la conexion y debe pasarla a los metodos del repository.
 */
async function withTransaction(callback) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = { query, run, withTransaction };
