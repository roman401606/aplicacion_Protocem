'use strict';

const proyectoRepository = require('../repositories/proyecto.repository');
const { AppError } = require('../utils/http');

async function listar() {
  return proyectoRepository.findAll();
}

async function obtener(id) {
  const proyecto = await proyectoRepository.findById(id);
  if (!proyecto) throw new AppError(404, 'No encontrado');

  const [compras, salidas] = await Promise.all([
    proyectoRepository.findCompras(id),
    proyectoRepository.findSalidas(id)
  ]);

  return { proyecto, compras, salidas };
}

async function crear(body, user) {
  const { nombre_obra, descripcion, fecha_inicio, fecha_fin_estimada, presupuesto, zona } = body;
  if (!nombre_obra || !fecha_inicio || !presupuesto) {
    throw new AppError(400, 'Faltan campos obligatorios');
  }

  const result = await proyectoRepository.create({
    nombre_obra,
    descripcion: descripcion || null,
    fecha_inicio,
    fecha_fin_estimada: fecha_fin_estimada || null,
    presupuesto,
    zona: zona || 'Centro',
    id_usuario: user.id
  });

  return { id: result.insertId, message: 'Proyecto creado' };
}

async function actualizarAvance(id, { porcentaje_avance, estado }) {
  await proyectoRepository.updateAvance(id, {
    porcentaje_avance,
    estado: estado || ''
  });
  return { message: 'Avance actualizado' };
}

async function eliminar(id) {
  const proyecto = await proyectoRepository.findNombre(id);
  if (!proyecto) throw new AppError(404, 'Proyecto no encontrado');

  await proyectoRepository.remove(id);
  return { message: 'Proyecto eliminado', nombre_obra: proyecto.nombre_obra };
}

module.exports = { listar, obtener, crear, actualizarAvance, eliminar };
