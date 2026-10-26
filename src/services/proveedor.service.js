'use strict';

const proveedorRepository = require('../repositories/proveedor.repository');
const { AppError } = require('../utils/http');

async function listar() {
  return proveedorRepository.findAll();
}

async function crear({ nombre, empresa, telefono, contacto }) {
  if (!nombre) throw new AppError(400, 'nombre es obligatorio');

  const result = await proveedorRepository.create({
    nombre,
    empresa: empresa || null,
    telefono: telefono || null,
    contacto: contacto || null
  });

  return { id: result.insertId, message: 'Proveedor creado' };
}

module.exports = { listar, crear };
