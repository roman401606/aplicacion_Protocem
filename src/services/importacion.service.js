'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const config = require('../../config');
const importacionRepository = require('../repositories/importacion.repository');
const {
  parseOpusWorkbook,
  parseFecha,
  parseNumero,
  normalizar
} = require('../utils/opusParser');
const { AppError } = require('../utils/http');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZONAS = ['Norte', 'Frontera', 'Turístico', 'Centro', 'Sur'];

const MAX_PRESUPUESTO = 999999999999.99;
const MAX_CANTIDAD = 999999999.999;
const MAX_PRECIO = 99999999.99;
const MAX_TOTAL = 999999999999.99;

const confirmacionesEnProceso = new Set();

function limpiarTexto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

function redondear(numero, decimales) {
  const factor = 10 ** decimales;
  return Math.round((numero + Number.EPSILON) * factor) / factor;
}

function normalizarIdPreview(id) {
  const texto = limpiarTexto(id).toLowerCase();

  if (!UUID_REGEX.test(texto)) {
    throw new AppError(400, 'Identificador de importacion invalido.');
  }

  return texto;
}

function rutaPreview(id) {
  return path.join(config.importPreviewDir, `${normalizarIdPreview(id)}.json`);
}

/**
 * Borra los archivos de vista previa que ya superaron el TTL.
 * Es una limpieza oportunista: nunca debe impedir una importacion.
 */
async function limpiarPreviewsExpirados() {
  let archivos;

  try {
    archivos = await fs.readdir(config.importPreviewDir);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('No se pudo leer el directorio de importaciones:', error.message);
    }
    return;
  }

  const ahora = Date.now();

  await Promise.all(
    archivos
      .filter((nombre) => nombre.endsWith('.json'))
      .map(async (nombre) => {
        const ruta = path.join(config.importPreviewDir, nombre);

        try {
          const info = await fs.stat(ruta);
          if (ahora - info.mtimeMs >= config.importPreviewTtlMs) {
            await fs.unlink(ruta);
          }
        } catch (_error) {
          // Otro proceso pudo borrar el archivo; no es un error fatal.
        }
      })
  );
}

async function borrarPreview(id) {
  try {
    await fs.unlink(rutaPreview(id));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * Procesa el Excel en memoria y guarda la vista previa como JSON temporal.
 * Devuelve el id con el que el cliente puede confirmar o descartar.
 */
async function crearPreview(buffer, { nombreArchivo, idUsuario } = {}) {
  const preview = parseOpusWorkbook(buffer, {
    nombreArchivo,
    maxFilas: config.importMaxRows
  });

  const id = crypto.randomUUID();
  const creado = new Date();
  const expira = new Date(creado.getTime() + config.importPreviewTtlMs);

  const registro = {
    id,
    archivo: limpiarTexto(nombreArchivo) || null,
    id_usuario: idUsuario || null,
    creado_en: creado.toISOString(),
    expira_en: expira.toISOString(),
    preview
  };

  await fs.mkdir(config.importPreviewDir, { recursive: true });
  await fs.writeFile(rutaPreview(id), JSON.stringify(registro), 'utf8');
  await limpiarPreviewsExpirados();

  return {
    id,
    archivo: registro.archivo,
    expira_en: registro.expira_en,
    ttl_ms: config.importPreviewTtlMs,
    preview
  };
}

async function leerPreview(id) {
  const idNormalizado = normalizarIdPreview(id);
  const ruta = rutaPreview(idNormalizado);

  let contenido;

  try {
    contenido = await fs.readFile(ruta, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new AppError(
        404,
        'La vista previa no existe o expiro. Vuelve a subir el archivo.'
      );
    }
    throw error;
  }

  let registro;

  try {
    registro = JSON.parse(contenido);
  } catch (_error) {
    try {
      await borrarPreview(idNormalizado);
    } catch (_borradoError) {
      // El archivo danado se ignora; el error relevante es el 500.
    }
    throw new AppError(500, 'La vista previa esta danada. Vuelve a subir el archivo.');
  }

  const expira = Date.parse(registro.expira_en);

  if (!registro.preview || !Number.isFinite(expira) || expira <= Date.now()) {
    try {
      await borrarPreview(idNormalizado);
    } catch (_borradoError) {
      // Si no se puede borrar, igualmente debe expirar para el cliente.
    }
    throw new AppError(410, 'La vista previa expiro. Vuelve a subir el archivo.');
  }

  return registro;
}

function normalizarZona(valor) {
  const texto = limpiarTexto(valor);
  if (!texto) return 'Centro';

  const clave = normalizar(texto);
  return ZONAS.find((zona) => normalizar(zona) === clave) || null;
}

function validarMateriales(materiales) {
  if (!Array.isArray(materiales) || materiales.length === 0) {
    throw new AppError(400, 'La vista previa no contiene materiales para importar.');
  }

  return materiales.map((material, indice) => {
    const numeroFila = indice + 1;

    if (!material || typeof material !== 'object') {
      throw new AppError(400, `El material ${numeroFila} no tiene un formato valido.`);
    }

    const descripcion = limpiarTexto(material.descripcion);
    if (!descripcion) {
      throw new AppError(400, `El material ${numeroFila} no tiene descripcion.`);
    }
    if (descripcion.length > 200) {
      throw new AppError(400, `La descripcion del material ${numeroFila} supera 200 caracteres.`);
    }

    const unidades = limpiarTexto(material.unidades) || 'pza';
    if (unidades.length > 40) {
      throw new AppError(400, `La unidad del material ${numeroFila} supera 40 caracteres.`);
    }

    const cantidad = parseNumero(material.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > MAX_CANTIDAD) {
      throw new AppError(400, `La cantidad del material ${numeroFila} no es valida.`);
    }

    const precioUnitario = parseNumero(material.precio_unitario);
    if (
      !Number.isFinite(precioUnitario) ||
      precioUnitario < 0 ||
      precioUnitario > MAX_PRECIO
    ) {
      throw new AppError(400, `El precio unitario del material ${numeroFila} no es valido.`);
    }

    const total = redondear(cantidad * precioUnitario, 2);
    if (total > MAX_TOTAL) {
      throw new AppError(400, `El total del material ${numeroFila} supera el maximo permitido.`);
    }

    return {
      descripcion,
      unidades,
      cantidad: redondear(cantidad, 3),
      precio_unitario: redondear(precioUnitario, 2),
      total
    };
  });
}

function validarConfirmacion(preview, datos = {}) {
  const entrada = datos && typeof datos === 'object' ? datos : {};

  const nombreObra = limpiarTexto(entrada.nombre_obra ?? preview.nombre_obra);
  if (!nombreObra) {
    throw new AppError(400, 'El nombre de la obra es obligatorio.');
  }
  if (nombreObra.length > 200) {
    throw new AppError(400, 'El nombre de la obra supera 200 caracteres.');
  }

  const fechaEntrada = entrada.fecha_inicio ?? preview.fecha_inicio;
  const fechaInicio = parseFecha(fechaEntrada);
  if (!fechaInicio) {
    throw new AppError(
      400,
      'La fecha de inicio es obligatoria y debe ser una fecha valida (AAAA-MM-DD).'
    );
  }

  const presupuestoEntrada = entrada.presupuesto_total ?? preview.presupuesto_total;
  const presupuesto = parseNumero(presupuestoEntrada);
  if (
    !Number.isFinite(presupuesto) ||
    presupuesto < 0 ||
    presupuesto > MAX_PRESUPUESTO
  ) {
    throw new AppError(400, 'El presupuesto total no es valido.');
  }

  const zonaEntrada = entrada.zona ?? preview.zona ?? 'Centro';
  const zona = normalizarZona(zonaEntrada);
  if (!zona) {
    throw new AppError(
      400,
      `Zona invalida. Valores permitidos: ${ZONAS.join(', ')}.`
    );
  }

  return {
    nombre_obra: nombreObra,
    fecha_inicio: fechaInicio,
    presupuesto: redondear(presupuesto, 2),
    zona,
    materiales: validarMateriales(preview.materiales)
  };
}

/**
 * Confirma una vista previa y crea el proyecto borrador.
 * El preview se conserva si la transaccion falla para permitir reintentos.
 */
async function confirmarImportacion(id, datos = {}, usuario = null) {
  const idNormalizado = normalizarIdPreview(id);

  if (confirmacionesEnProceso.has(idNormalizado)) {
    throw new AppError(409, 'La importacion ya se esta procesando.');
  }

  confirmacionesEnProceso.add(idNormalizado);

  try {
    const registro = await leerPreview(idNormalizado);
    const validado = validarConfirmacion(registro.preview, datos);

    const idUsuarioToken = Number(usuario && usuario.id);
    const idUsuarioPreview = Number(registro.id_usuario);
    const idUsuario = Number.isInteger(idUsuarioToken) && idUsuarioToken > 0
      ? idUsuarioToken
      : idUsuarioPreview;

    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      throw new AppError(
        400,
        'No se pudo identificar al usuario que confirma la importacion.'
      );
    }

    const resultado = await importacionRepository.crearProyectoImportado({
      ...validado,
      id_usuario: idUsuario
    });

    // El proyecto ya esta confirmado. Un fallo al borrar el temporal no debe
    // convertir una importacion exitosa en un error para el cliente.
    try {
      await borrarPreview(idNormalizado);
    } catch (error) {
      console.error(
        `No se pudo borrar la vista previa ${idNormalizado} despues de confirmar:`,
        error.message
      );
    }

    return {
      id_proyecto: resultado.id_proyecto,
      id_proveedor: resultado.id_proveedor,
      nombre_obra: validado.nombre_obra,
      estado: 'borrador',
      materiales_importados: resultado.materiales_importados,
      total_importado: resultado.total_importado,
      message: 'Proyecto importado como borrador'
    };
  } finally {
    confirmacionesEnProceso.delete(idNormalizado);
  }
}

/**
 * Descarta una vista previa (UUID) o un proyecto borrador ya creado (id numerico).
 */
async function descartarImportacion(id) {
  const texto = limpiarTexto(id);

  if (UUID_REGEX.test(texto)) {
    const borrado = await borrarPreview(texto.toLowerCase());

    if (!borrado) {
      throw new AppError(404, 'La vista previa no existe o ya fue descartada.');
    }

    return {
      message: 'Vista previa descartada',
      id: texto.toLowerCase()
    };
  }

  if (/^\d+$/.test(texto)) {
    const idProyecto = Number(texto);

    if (!Number.isSafeInteger(idProyecto) || idProyecto <= 0 || idProyecto > 2147483647) {
      throw new AppError(400, 'Identificador de proyecto invalido.');
    }

    const resultado = await importacionRepository.descartarProyectoBorrador(idProyecto);

    if (!resultado.encontrado) {
      throw new AppError(404, 'Proyecto no encontrado.');
    }

    if (!resultado.eliminado) {
      if (resultado.motivo === 'NO_ES_BORRADOR') {
        throw new AppError(409, 'Solo se pueden descartar proyectos en estado borrador.');
      }

      if (resultado.motivo === 'TIENE_MOVIMIENTOS') {
        throw new AppError(
          409,
          'El proyecto tiene compras o salidas registradas; no se puede descartar.'
        );
      }

      throw new AppError(409, 'No se pudo descartar el proyecto.');
    }

    return {
      message: 'Proyecto borrador descartado',
      id_proyecto: idProyecto,
      nombre_obra: resultado.proyecto.nombre_obra,
      cotizaciones_eliminadas: resultado.cotizaciones_eliminadas,
      productos_eliminados: resultado.productos_eliminados,
      proveedores_eliminados: resultado.proveedores_eliminados
    };
  }

  throw new AppError(400, 'Identificador de importacion invalido.');
}

module.exports = {
  crearPreview,
  confirmarImportacion,
  descartarImportacion,
  limpiarPreviewsExpirados,
  ZONAS
};
