'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');

const {
  parseOpusWorkbook,
  parseNumero,
  parseFecha,
  mapearColumnas,
  OpusParseError,
  MAX_ADVERTENCIAS
} = require('../src/utils/opusParser');

function crearExcel(filas, nombreHoja = 'Presupuesto') {
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
}

function crearExcelConHojas(hojas) {
  const libro = XLSX.utils.book_new();

  for (const [nombre, filas] of hojas) {
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), nombre);
  }

  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
}

function material(descripcion, unidades, cantidad, precio_unitario, total) {
  return { descripcion, unidades, cantidad, precio_unitario, total };
}

test('parsea una hoja estandar con metadatos, materiales y subtotal', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Nombre de obra:', 'Casa Demo'],
    ['Fecha de inicio:', '15/03/2026'],
    ['Presupuesto total:', '$1,234.56'],
    [],
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    ['Cemento', 'kg', 10, 100, 1000],
    ['Arena', 'm3', '2', '$117.28', 234.56],
    ['Subtotal', null, null, null, 1234.56]
  ]), { nombreArchivo: 'casa-demo.xlsx' });

  assert.equal(resultado.nombre_obra, 'Casa Demo');
  assert.equal(resultado.fecha_inicio, '2026-03-15');
  assert.equal(resultado.presupuesto_total, 1234.56);
  assert.equal(resultado.confianza_parseo, 100);

  assert.deepEqual(resultado.materiales, [
    material('Cemento', 'kg', 10, 100, 1000),
    material('Arena', 'm3', 2, 117.28, 234.56)
  ]);

  assert.equal(resultado.meta.hoja, 'Presupuesto');
  assert.equal(resultado.meta.fila_encabezado, 5);
  assert.equal(resultado.meta.filas_encabezado, 1);
  assert.equal(resultado.meta.filas_leidas, 3);
  assert.equal(resultado.meta.filas_importadas, 2);
  assert.equal(resultado.meta.filas_omitidas, 1);
  assert.equal(resultado.meta.suma_totales, 1234.56);
  assert.deepEqual(resultado.meta.columnas_faltantes, []);
  assert.equal(resultado.meta.columnas_detectadas.descripcion, 'Descripción');
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('subtotal')));
});

test('reconoce los alias Concepto, Unid., Cant., P.U. e Importe', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Concepto', 'Unid.', 'Cant.', 'P.U.', 'Importe'],
    ['Cemento', 'kg', 10, 100, 1000]
  ]), { nombreArchivo: 'alias.xlsx' });

  assert.deepEqual(resultado.meta.columnas_detectadas, {
    descripcion: 'Concepto',
    unidades: 'Unid.',
    cantidad: 'Cant.',
    precio_unitario: 'P.U.',
    total: 'Importe'
  });

  assert.equal(resultado.materiales.length, 1);
  assert.deepEqual(resultado.materiales[0], material('Cemento', 'kg', 10, 100, 1000));
  assert.equal(resultado.confianza_parseo, 100);
});

test('reconoce Material, Unidad de medida y Precio Unit', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Material', 'Unidad de medida', 'Cantidad', 'Precio Unit', 'Total'],
    ['Arena', 'm3', 2, 50, 100]
  ]), { nombreArchivo: 'material.xlsx' });

  assert.equal(resultado.meta.columnas_detectadas.descripcion, 'Material');
  assert.equal(resultado.meta.columnas_detectadas.unidades, 'Unidad de medida');
  assert.equal(resultado.meta.columnas_detectadas.precio_unitario, 'Precio Unit');
  assert.deepEqual(resultado.materiales[0], material('Arena', 'm3', 2, 50, 100));
});

test('mapearColumnas tolera errores de escritura y encabezados no relacionados', () => {
  const conTypo = mapearColumnas([
    'Descripcin',
    'Unidad',
    'Cantidad',
    'Precio Unitario',
    'Total'
  ]);

  assert.equal(conTypo.columnas.descripcion, 0);
  assert.ok(conTypo.puntajes.descripcion >= 0.72);
  assert.equal(conTypo.faltantes.length, 0);

  const sinAcento = mapearColumnas([
    'Descripcion',
    'Unidad',
    'Cantidad',
    'Precio Unitario',
    'Total'
  ]);
  assert.equal(sinAcento.columnas.descripcion, 0);

  const sinRelacion = mapearColumnas(['Foo', 'Bar', 'Baz']);
  assert.deepEqual(sinRelacion.columnas, {});
  assert.equal(sinRelacion.cobertura, 0);
});

test('detecta un encabezado repartido en dos filas', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Descripción', 'Unidad', 'Cantidad', null, null],
    [null, null, null, 'Precio Unitario', 'Total'],
    ['Cemento', 'kg', 10, 100, 1000],
    ['Arena', 'm3', 2, 50, 100]
  ]), { nombreArchivo: 'dos-filas.xlsx' });

  assert.equal(resultado.meta.fila_encabezado, 1);
  assert.equal(resultado.meta.filas_encabezado, 2);
  assert.equal(resultado.materiales.length, 2);
  assert.equal(resultado.presupuesto_total, 1100);
  assert.deepEqual(resultado.meta.columnas_faltantes, []);
});

test('calcula el total y usa pza cuando faltan esas columnas', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Descripción', 'Cantidad', 'Precio Unitario'],
    ['Cemento', 10, 100],
    ['Arena', 2, 50]
  ]), { nombreArchivo: 'sin-total.xlsx' });

  assert.deepEqual(resultado.materiales, [
    material('Cemento', 'pza', 10, 100, 1000),
    material('Arena', 'pza', 2, 50, 100)
  ]);

  assert.equal(resultado.presupuesto_total, 1100);
  assert.equal(resultado.confianza_parseo, 88);
  assert.deepEqual(
    [...resultado.meta.columnas_faltantes].sort(),
    ['total', 'unidades']
  );
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('No se detecto la columna Total')));
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('No se detecto la columna Unidad')));
});

test('deriva el precio unitario desde el total y la cantidad', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Descripción', 'Unidad', 'Cantidad', 'Total'],
    ['Cemento', 'kg', 10, 1000],
    ['Arena', 'm3', 2, 100]
  ]), { nombreArchivo: 'sin-precio.xlsx' });

  assert.equal(resultado.materiales[0].precio_unitario, 100);
  assert.equal(resultado.materiales[1].precio_unitario, 50);
  assert.ok(resultado.meta.columnas_faltantes.includes('precio_unitario'));
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('precio unitario estaba vacio')));
  assert.ok(resultado.confianza_parseo < 100);
});

test('deriva el precio unitario si viene en cero y el total es positivo', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    ['Cemento', 'kg', 10, 0, 1000]
  ]), { nombreArchivo: 'precio-cero.xlsx' });

  assert.equal(resultado.materiales[0].precio_unitario, 100);
  assert.equal(resultado.materiales[0].total, 1000);
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('precio unitario estaba vacio')));
});

test('deriva la cantidad desde el total y el precio unitario', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Descripción', 'Unidad', 'Precio Unitario', 'Total'],
    ['Cemento', 'kg', 100, 1000],
    ['Arena', 'm3', 50, 100]
  ]), { nombreArchivo: 'sin-cantidad.xlsx' });

  assert.equal(resultado.materiales[0].cantidad, 10);
  assert.equal(resultado.materiales[1].cantidad, 2);
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('cantidad estaba vacia')));
});

test('omite encabezados de seccion, subtotales y filas invalidas', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    ['MATERIALES', null, null, null, null],
    ['Cemento', 'kg', 10, 100, 1000],
    ['Subtotal', null, null, null, 1000],
    ['Total', null, null, null, 1000],
    ['Arena', 'm3', -1, 50, -50],
    ['Grava', 'm3', 2, 50, 100]
  ]), { nombreArchivo: 'omitidas.xlsx' });

  assert.equal(resultado.materiales.length, 2);
  assert.equal(resultado.meta.filas_leidas, 6);
  assert.equal(resultado.meta.filas_importadas, 2);
  assert.equal(resultado.meta.filas_omitidas, 4);
  assert.equal(resultado.meta.filas_invalidas, 1);
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('no es valida')));
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('encabezados de seccion o subtotales')));
  assert.ok(resultado.confianza_parseo < 100);
});

test('respeta el limite de filas configurado', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    ['Cemento', 'kg', 10, 100, 1000],
    ['Arena', 'm3', 2, 50, 100],
    ['Grava', 'm3', 3, 30, 90]
  ]), { nombreArchivo: 'max.xlsx', maxFilas: 2 });

  assert.equal(resultado.materiales.length, 2);
  assert.equal(resultado.meta.filas_no_procesadas, 1);
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('solo las primeras 2')));
});

test('limita la cantidad de advertencias a MAX_ADVERTENCIAS', () => {
  const filas = [
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    ['Cemento', 'kg', 10, 100, 1000]
  ];

  for (let indice = 0; indice < 120; indice++) {
    filas.push([`Invalido ${indice}`, 'kg', 'x', 10, null]);
  }

  const resultado = parseOpusWorkbook(crearExcel(filas), { nombreArchivo: 'limite.xlsx' });

  assert.equal(resultado.materiales.length, 1);
  assert.ok(resultado.advertencias.length <= MAX_ADVERTENCIAS);
  assert.ok(
    resultado.advertencias[resultado.advertencias.length - 1]
      .includes(`limite de ${MAX_ADVERTENCIAS} advertencias`)
  );
});

test('elige la hoja con mas materiales cuando hay varias hojas', () => {
  const resultado = parseOpusWorkbook(crearExcelConHojas([
    ['Portada', [['Presupuesto'], ['Casa Demo']]],
    ['Materiales', [
      ['Nombre de obra:', 'Casa Demo'],
      ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
      ['Cemento', 'kg', 10, 100, 1000],
      ['Arena', 'm3', 2, 50, 100]
    ]],
    ['Resumen', [
      ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
      ['Grava', 'm3', 3, 30, 90]
    ]]
  ]), { nombreArchivo: 'multi.xlsx' });

  assert.equal(resultado.meta.hoja, 'Materiales');
  assert.equal(resultado.materiales.length, 2);
  assert.equal(resultado.nombre_obra, 'Casa Demo');
});

test('lee metadatos de una portada aunque la tabla este en otra hoja', () => {
  const resultado = parseOpusWorkbook(crearExcelConHojas([
    ['Portada', [
      ['Nombre de obra:', 'Casa Demo'],
      ['Fecha de inicio:', '15/03/2026'],
      ['Presupuesto total:', '$1,234.56']
    ]],
    ['Materiales', [
      ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
      ['Cemento', 'kg', 10, 100, 1000],
      ['Arena', 'm3', 2, 117.28, 234.56]
    ]]
  ]), { nombreArchivo: 'portada.xlsx' });

  assert.equal(resultado.nombre_obra, 'Casa Demo');
  assert.equal(resultado.fecha_inicio, '2026-03-15');
  assert.equal(resultado.presupuesto_total, 1234.56);
  assert.equal(resultado.meta.hoja, 'Materiales');
});

test('lee metadatos en la misma celda y avisa si el presupuesto no cuadra', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Nombre de obra: Casa Demo'],
    ['Fecha de inicio:', '15/03/2026'],
    ['Presupuesto total:', '$2,000.00'],
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    ['Cemento', 'kg', 10, 100, 1000],
    ['Arena', 'm3', 2, 50, 100]
  ]), { nombreArchivo: 'meta.xlsx' });

  assert.equal(resultado.nombre_obra, 'Casa Demo');
  assert.equal(resultado.fecha_inicio, '2026-03-15');
  assert.equal(resultado.presupuesto_total, 2000);
  assert.equal(resultado.meta.suma_totales, 1100);
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('difiere de la suma')));
});

test('lee fecha y presupuesto sin dos puntos en la misma celda', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Nombre de obra: Casa Demo'],
    ['Fecha de inicio 15/03/2026'],
    ['Presupuesto total $2,000.00'],
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    ['Cemento', 'kg', 10, 100, 1000]
  ]), { nombreArchivo: 'sin-dos-puntos.xlsx' });

  assert.equal(resultado.fecha_inicio, '2026-03-15');
  assert.equal(resultado.presupuesto_total, 2000);
});

test('lee el nombre de obra sin dos puntos en la misma celda', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Nombre de obra Casa Demo'],
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    ['Cemento', 'kg', 10, 100, 1000]
  ]), { nombreArchivo: 'nombre-sin-dos-puntos.xlsx' });

  assert.equal(resultado.nombre_obra, 'Casa Demo');
});

test('usa el nombre del archivo cuando no hay nombre de obra', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    ['Cemento', 'kg', 10, 100, 1000]
  ]), { nombreArchivo: 'mi_obra-2026.xlsx' });

  assert.equal(resultado.nombre_obra, 'mi obra 2026');
  assert.equal(resultado.fecha_inicio, null);
  assert.equal(resultado.presupuesto_total, 1000);
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('No se detecto el nombre de la obra')));
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('No se detecto la fecha de inicio')));
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('No se detecto el presupuesto total')));
});

test('no confunde una etiqueta de metadato con un encabezado de tabla', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Proyecto', 'Cantidad'],
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    ['Cemento', 'kg', 10, 100, 1000]
  ]), { nombreArchivo: 'sin-nombre.xlsx' });

  assert.equal(resultado.nombre_obra, 'sin nombre');
  assert.ok(!resultado.nombre_obra.toLowerCase().includes('cantidad'));
});

test('conserva el numero real de fila en las advertencias', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    [],
    ['Cemento', 'kg', 'x', 100, null],
    ['Arena', 'm3', 2, 50, 100]
  ]), { nombreArchivo: 'filas.xlsx' });

  assert.equal(resultado.materiales.length, 1);
  assert.ok(
    resultado.advertencias.includes('Fila 3: la cantidad no es valida; se omitio.')
  );
});

test('trunca descripciones y unidades a los limites de la base de datos', () => {
  const descripcionLarga = 'D'.repeat(250);
  const unidadLarga = 'U'.repeat(50);

  const resultado = parseOpusWorkbook(crearExcel([
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    [descripcionLarga, unidadLarga, 1, 10, 10]
  ]), { nombreArchivo: 'truncar.xlsx' });

  assert.equal(resultado.materiales[0].descripcion.length, 200);
  assert.equal(resultado.materiales[0].unidades.length, 40);
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('descripcion supera 200')));
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('Se trunco 1 unidad')));
});

test('usa el total calculado cuando el total declarado no coincide', () => {
  const resultado = parseOpusWorkbook(crearExcel([
    ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
    ['Cemento', 'kg', 10, 100, 800]
  ]), { nombreArchivo: 'descuadre.xlsx' });

  assert.equal(resultado.materiales[0].total, 1000);
  assert.ok(resultado.advertencias.some((aviso) => aviso.includes('no coincide con cantidad x precio')));
});

test('parseNumero acepta formatos mexicanos e internacionales', () => {
  const casos = [
    ['1,234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['$2,500.00', 2500],
    ['0,500', 0.5],
    ['(100.00)', -100],
    ['-1,234.56', -1234.56],
    ['1,234', 1234],
    ['1.234.567', 1234567],
    ['12,345.67', 12345.67],
    ['1e3', 1000],
    ['MXN', null],
    ['', null],
    [null, null]
  ];

  for (const [entrada, esperado] of casos) {
    assert.equal(parseNumero(entrada), esperado, `parseNumero(${String(entrada)})`);
  }
});

test('parseFecha acepta formatos comunes y rechaza fechas imposibles', () => {
  const casos = [
    ['15/03/2026', '2026-03-15'],
    ['2026-03-15', '2026-03-15'],
    ['15 de marzo de 2026', '2026-03-15'],
    ['3/15/2026', '2026-03-15'],
    ['15/03/26', '2026-03-15'],
    ['15-mar-2026', '2026-03-15'],
    ['marzo 15, 2026', '2026-03-15'],
    ['15/03/2026 al 30/06/2026', '2026-03-15'],
    ['20260315', '2026-03-15'],
    ['31/02/2026', null],
    ['2026', null],
    ['', null],
    [null, null]
  ];

  for (const [entrada, esperado] of casos) {
    assert.equal(parseFecha(entrada), esperado, `parseFecha(${String(entrada)})`);
  }

  assert.equal(parseFecha(new Date(Date.UTC(2026, 2, 15))), '2026-03-15');
  assert.equal(parseFecha(45000), '2023-03-15');
  assert.equal(parseFecha('45000'), '2023-03-15');
  assert.equal(parseFecha(20260315), '2026-03-15');
});

test('lanza errores controlados para archivos invalidos o sin materiales', () => {
  assert.throws(
    () => parseOpusWorkbook(Buffer.alloc(0)),
    (error) => error instanceof OpusParseError &&
      error.code === 'ARCHIVO_VACIO' &&
      error.status === 400
  );

  assert.throws(
    () => parseOpusWorkbook(crearExcel([['Hola', 'Mundo'], ['A', 'B']])),
    (error) => error instanceof OpusParseError &&
      error.code === 'SIN_ENCABEZADO' &&
      error.status === 422
  );

  assert.throws(
    () => parseOpusWorkbook(crearExcel([
      ['Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Total'],
      ['Subtotal', null, null, null, 1000]
    ])),
    (error) => error instanceof OpusParseError &&
      error.code === 'SIN_MATERIALES' &&
      error.status === 422
  );
});
