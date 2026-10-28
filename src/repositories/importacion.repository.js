'use strict';

const { query, run, withTransaction } = require('./base.repository');

/**
 * Marca tecnica que identifica al proveedor creado por una importacion.
 * Se usa el id del proyecto para que cada importacion tenga su propio
 * proveedor y no se mezclen cotizaciones entre proyectos.
 */
const PREFIJO_EMPRESA = 'IMPORTACION_OPUS:';
const ESPECIALIDAD_IMPORTACION = 'importacion_opus';

function empresaImportacion(idProyecto) {
  return `${PREFIJO_EMPRESA}${idProyecto}`;
}

/**
 * Crea el proyecto borrador, su proveedor tecnico, un PRODUCTO por material
 * y una COTIZACION por producto. Todo ocurre dentro de una transaccion:
 * si falla cualquier insercion no queda ningun registro parcial.
 */
async function crearProyectoImportado({
  nombre_obra,
  fecha_inicio,
  presupuesto,
  zona,
  id_usuario,
  materiales
}) {
  return withTransaction(async (conn) => {
    const proyecto = await run(
      `INSERT INTO PROYECTO
        (nombre_obra, descripcion, fecha_inicio, fecha_fin_estimada, presupuesto,
         porcentaje_avance, estado, zona, id_usuario)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [nombre_obra, null, fecha_inicio, null, presupuesto, 0, 'borrador', zona, id_usuario],
      conn
    );

    const idProyecto = proyecto.insertId;

    const proveedor = await run(
      `INSERT INTO PROVEEDOR (nombre, empresa, telefono, contacto, especialidad)
       VALUES (?,?,?,?,?)`,
      ['Importacion Opus', empresaImportacion(idProyecto), null, null, ESPECIALIDAD_IMPORTACION],
      conn
    );

    const idProveedor = proveedor.insertId;
    const productos = [];
    let totalImportado = 0;

    for (const material of materiales) {
      const producto = await run(
        `INSERT INTO PRODUCTO
          (descripcion, tipo_producto, unidades, precio_referencia, stock)
         VALUES (?,?,?,?,?)`,
        [material.descripcion, 'Material', material.unidades, material.precio_unitario, 0],
        conn
      );

      const idProducto = producto.insertId;

      const cotizacion = await run(
        `INSERT INTO COTIZACION
          (fecha_cotizacion, precio_cotizado, id_producto, id_proveedor)
         VALUES (CURDATE(),?,?,?)`,
        [material.precio_unitario, idProducto, idProveedor],
        conn
      );

      totalImportado += material.total;

      productos.push({
        id_producto: idProducto,
        id_cotizacion: cotizacion.insertId,
        descripcion: material.descripcion,
        unidades: material.unidades,
        cantidad: material.cantidad,
        precio_unitario: material.precio_unitario,
        total: material.total
      });
    }

    return {
      id_proyecto: idProyecto,
      id_proveedor: idProveedor,
      materiales_importados: productos.length,
      total_importado: Math.round((totalImportado + Number.EPSILON) * 100) / 100,
      productos
    };
  });
}

/**
 * Descarta un proyecto importado solo si sigue en estado 'borrador' y no
 * tiene compras ni salidas. Limpia primero las cotizaciones del proveedor
 * tecnico, luego los productos sin referencias, el proveedor y el proyecto.
 */
async function descartarProyectoBorrador(idProyecto) {
  return withTransaction(async (conn) => {
    const proyectos = await query(
      `SELECT id_proyecto, nombre_obra, estado
         FROM PROYECTO
        WHERE id_proyecto=?
        FOR UPDATE`,
      [idProyecto],
      conn
    );

    if (!proyectos.length) return { encontrado: false };

    const proyecto = proyectos[0];

    if (proyecto.estado !== 'borrador') {
      return {
        encontrado: true,
        eliminado: false,
        motivo: 'NO_ES_BORRADOR',
        proyecto
      };
    }

    const compras = await query(
      'SELECT COUNT(*) AS total FROM COMPRA WHERE id_proyecto=?',
      [idProyecto],
      conn
    );
    const salidas = await query(
      'SELECT COUNT(*) AS total FROM SALIDA WHERE id_proyecto=?',
      [idProyecto],
      conn
    );

    if (Number(compras[0].total) > 0 || Number(salidas[0].total) > 0) {
      return {
        encontrado: true,
        eliminado: false,
        motivo: 'TIENE_MOVIMIENTOS',
        proyecto
      };
    }

    const proveedores = await query(
      `SELECT id_proveedor
         FROM PROVEEDOR
        WHERE empresa=? AND especialidad=?`,
      [empresaImportacion(idProyecto), ESPECIALIDAD_IMPORTACION],
      conn
    );

    let cotizacionesEliminadas = 0;
    let productosEliminados = 0;
    let proveedoresEliminados = 0;

    for (const proveedor of proveedores) {
      const cotizaciones = await query(
        'SELECT DISTINCT id_producto FROM COTIZACION WHERE id_proveedor=?',
        [proveedor.id_proveedor],
        conn
      );

      const idsProductos = cotizaciones.map((fila) => fila.id_producto);

      const borradoCotizaciones = await run(
        'DELETE FROM COTIZACION WHERE id_proveedor=?',
        [proveedor.id_proveedor],
        conn
      );
      cotizacionesEliminadas += borradoCotizaciones.affectedRows;

      if (idsProductos.length > 0) {
        const marcadores = idsProductos.map(() => '?').join(',');

        const borradoProductos = await run(
          `DELETE FROM PRODUCTO
            WHERE id_producto IN (${marcadores})
              AND NOT EXISTS (
                SELECT 1 FROM COTIZACION c WHERE c.id_producto = PRODUCTO.id_producto
              )
              AND NOT EXISTS (
                SELECT 1 FROM DETALLE_COMPRA dc WHERE dc.id_producto = PRODUCTO.id_producto
              )
              AND NOT EXISTS (
                SELECT 1 FROM DETALLE_SALIDA ds WHERE ds.id_producto = PRODUCTO.id_producto
              )
              AND NOT EXISTS (
                SELECT 1 FROM APU_MATERIAL am WHERE am.id_producto = PRODUCTO.id_producto
              )`,
          idsProductos,
          conn
        );

        productosEliminados += borradoProductos.affectedRows;
      }

      const borradoProveedor = await run(
        `DELETE FROM PROVEEDOR
          WHERE id_proveedor=?
            AND NOT EXISTS (
              SELECT 1 FROM COTIZACION c WHERE c.id_proveedor = PROVEEDOR.id_proveedor
            )`,
        [proveedor.id_proveedor],
        conn
      );
      proveedoresEliminados += borradoProveedor.affectedRows;
    }

    const borradoProyecto = await run(
      'DELETE FROM PROYECTO WHERE id_proyecto=?',
      [idProyecto],
      conn
    );

    return {
      encontrado: true,
      eliminado: borradoProyecto.affectedRows > 0,
      motivo: borradoProyecto.affectedRows > 0 ? null : 'NO_ELIMINADO',
      proyecto,
      cotizaciones_eliminadas: cotizacionesEliminadas,
      productos_eliminados: productosEliminados,
      proveedores_eliminados: proveedoresEliminados
    };
  });
}

module.exports = {
  crearProyectoImportado,
  descartarProyectoBorrador,
  empresaImportacion,
  PREFIJO_EMPRESA,
  ESPECIALIDAD_IMPORTACION
};
