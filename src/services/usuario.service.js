'use strict';

const bcrypt = require('bcryptjs');
const config = require('../../config');
const usuarioRepository = require('../repositories/usuario.repository');
const { AppError } = require('../utils/http');

async function listar() {
  return usuarioRepository.findAll();
}

async function crear({ nombre_usuario, correo, rol, contrasena }) {
  if (!nombre_usuario || !correo || !rol || !contrasena) {
    throw new AppError(400, 'Todos los campos son obligatorios');
  }

  const contrasena_hash = await bcrypt.hash(contrasena, config.bcryptRounds);
  try {
    const result = await usuarioRepository.create({
      nombre_usuario,
      correo,
      rol,
      contrasena_hash
    });
    return { id: result.insertId, message: 'Usuario creado' };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AppError(400, 'El correo ya existe');
    }
    throw error;
  }
}

module.exports = { listar, crear };
