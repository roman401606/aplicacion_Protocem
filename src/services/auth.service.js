'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const usuarioRepository = require('../repositories/usuario.repository');
const { AppError } = require('../utils/http');

async function login({ correo, contrasena }) {
  if (!correo || !contrasena) {
    throw new AppError(400, 'Correo y contrasena requeridos');
  }

  const user = await usuarioRepository.findByCorreo(correo);
  if (!user) throw new AppError(401, 'Credenciales incorrectas');

  const ok = await bcrypt.compare(contrasena, user.contrasena_hash);
  if (!ok) throw new AppError(401, 'Credenciales incorrectas');

  const token = jwt.sign(
    {
      id: user.id_usuario,
      nombre: user.nombre_usuario,
      correo: user.correo,
      rol: user.rol
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return {
    token,
    nombre: user.nombre_usuario,
    rol: user.rol,
    correo: user.correo
  };
}

module.exports = { login };
