'use strict';

const catalogoRepository = require('../repositories/catalogo.repository');
const { AppError } = require('../utils/http');

async function listar(query) {
  const limit = Math.min(parseInt(query.limit, 10) || 100, 500);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  const { especialidad, zona, fuente, q } = query;

  return catalogoRepository.find({
    especialidad,
    zona,
    fuente,
    q,
    limit,
    offset,
    onlyWithPrice: false
  });
}

async function listarEspecialidades() {
  return catalogoRepository.especialidades();
}

async function listarFasar(zona) {
  return catalogoRepository.fasar(zona);
}

async function crear(body) {
  const { clave, descripcion, unidad, especialidad } = body;
  if (!clave || !descripcion || !unidad || !especialidad) {
    throw new AppError(400, 'Faltan campos obligatorios');
  }

  const result = await catalogoRepository.create({
    clave,
    descripcion,
    unidad,
    precio_ref: body.precio_ref || null,
    especialidad,
    fuente: body.fuente || 'Libre',
    año_catalogo: body.año_catalogo || 2025,
    zona: body.zona || 'Nacional'
  });

  return { id: result.insertId, message: 'Concepto agregado al catálogo' };
}

async function actualizar(id, { precio_ref, descripcion, año_catalogo }) {
  await catalogoRepository.update(id, {
    precio_ref: precio_ref ?? null,
    descripcion: descripcion || null,
    año_catalogo: año_catalogo || null
  });
  return { message: 'Actualizado' };
}

module.exports = { listar, listarEspecialidades, listarFasar, crear, actualizar };
