'use strict';

const path = require('path');
const XLSX = require('xlsx');

/* ===== LIMITES ===== */
const MAX_FILAS_ENCABEZADO = 30;
const MAX_COLUMNAS = 200;
const MAX_ADVERTENCIAS = 100;
const MAX_FILAS_DEFAULT = 5000;
const MAX_DESCRIPCION = 200;
const MAX_UNIDADES = 40;
const MAX_CANTIDAD = 999999999.999;
const MAX_PRECIO = 99999999.99;
const MAX_TOTAL = 999999999999.99;
const UMBRAL_COINCIDENCIA = 0.72;
const UMBRAL_META = 0.9;

/**
 * Error controlado del parser.
 * El service lo puede propagar tal cual; el errorHandler usa `status`.
 */
class OpusParseError extends Error {
  constructor(message, code = 'PARSE_ERROR', status = 422) {
    super(message);
    this.name = 'OpusParseError';
    this.code = code;
    this.status = status;
    this.isOperational = true;
  }
}

/* ===== DEFINICION DE COLUMNAS ===== */
const CAMPOS = {
  descripcion: {
    peso: 30,
    aliases: [
      'descripcion',
      'descripcion del material',
      'descripcion de material',
      'descripcion material',
      'descripcion del concepto',
      'descripcion concepto',
      'material',
      'materiales',
      'concepto',
      'concepto material',
      'desc'
    ]
  },
  cantidad: {
    peso: 20,
    aliases: [
      'cantidad',
      'cantidad de obra',
      'cantidad obra',
      'cantidad material',
      'cant',
      'qty'
    ]
  },
  precio_unitario: {
    peso: 25,
    aliases: [
      'precio unitario',
      'precio unit',
      'precio unitario mxn',
      'precio unit mxn',
      'precio u',
      'p u',
      'pu',
      'pu mxn',
      'p u mxn',
      'unitario',
      'precio'
    ]
  },
  total: {
    peso: 10,
    aliases: [
      'total',
      'importe',
      'subtotal',
      'monto',
      'total importe',
      'importe total',
      'precio total',
      'total material',
      'total del concepto'
    ]
  },
  unidades: {
    peso: 5,
    aliases: [
      'unidad',
      'unidades',
      'unidad de medida',
      'unidad medida',
      'unid',
      'uds',
      'ud',
      'u m',
      'um',
      'un'
    ]
  }
};

const META_ALIASES = {
  nombre_obra: [
    'nombre de obra',
    'nombre obra',
    'nombre de la obra',
    'nombre del proyecto',
    'nombre proyecto',
    'descripcion de la obra',
    'descripcion obra',
    'obra',
    'proyecto'
  ],
  fecha_inicio: [
    'fecha de inicio',
    'fecha inicio',
    'fecha de inicio de obra',
    'fecha de comienzo',
    'fecha comienzo',
    'inicio',
    'fecha'
  ],
  presupuesto_total: [
    'presupuesto total',
    'presupuesto de obra',
    'presupuesto obra',
    'total presupuesto',
    'total del presupuesto',
    'importe total',
    'monto total',
    'presupuesto'
  ]
};

const ETIQUETAS_META = {
  nombre_obra: 'nombre de obra',
  fecha_inicio: 'fecha de inicio',
  presupuesto_total: 'presupuesto total'
};

/* ===== NORMALIZACION Y COINCIDENCIA ===== */
function limpiarTexto(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? '' : valor.toISOString().slice(0, 10);
  }
  return String(valor)
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizar(valor) {
  return limpiarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenizar(texto) {
  return texto ? texto.split(' ').filter(Boolean) : [];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const anterior = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) anterior[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let diagonal = anterior[0];
    anterior[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = anterior[j];
      anterior[j] = Math.min(
        anterior[j] + 1,
        anterior[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = temp;
    }
  }

  return anterior[b.length];
}

function similitud(a, b) {
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  if (!max) return 1;
  return 1 - levenshtein(a, b) / max;
}

function jaccard(a, b) {
  const tokensA = new Set(tokenizar(a));
  const tokensB = new Set(tokenizar(b));
  if (!tokensA.size || !tokensB.size) return 0;

  let interseccion = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) interseccion++;
  }
  return interseccion / (tokensA.size + tokensB.size - interseccion);
}

function puntuarAlias(headerNorm, alias, aliasIndex) {
  if (!headerNorm || !alias) return 0;

  const prioridad = Math.max(0.9, 1 - aliasIndex * 0.01);
  let base = 0;

  if (headerNorm === alias) {
    base = 1;
  } else {
    const tokensHeader = new Set(tokenizar(headerNorm));
    const tokensAlias = tokenizar(alias);
    const aliasContenido = tokensAlias.length > 0 && tokensAlias.every(t => tokensHeader.has(t));
    const aliasCompacto = alias.replace(/\s+/g, '');

    if (aliasCompacto.length <= 2) {
      // Alias como "un", "ud", "pu" solo cuentan como palabra completa.
      if (tokensHeader.has(alias) || tokensHeader.has(aliasCompacto)) base = 0.9;
    } else if (aliasContenido) {
      base = 0.92;
    } else if (
      (headerNorm.length >= 3 && headerNorm.includes(alias)) ||
      (alias.length >= 3 && alias.includes(headerNorm))
    ) {
      base = 0.84;
    } else {
      const jac = jaccard(headerNorm, alias);
      if (jac >= 0.6) {
        base = 0.78 + 0.12 * jac;
      } else {
        const sim = similitud(headerNorm, alias);
        if (sim >= 0.78) {
          base = 0.72 + 0.2 * ((sim - 0.78) / 0.22);
        }
      }
    }
  }

  return base * prioridad;
}

function puntuarCoincidencia(headerNorm, aliases) {
  let mejor = 0;
  aliases.forEach((alias, index) => {
    const puntaje = puntuarAlias(headerNorm, normalizar(alias), index);
    if (puntaje > mejor) mejor = puntaje;
  });
  return mejor;
}

/* ===== MAPEO DE COLUMNAS ===== */
function valorColumna(fila, indice) {
  if (!Array.isArray(fila) || indice === undefined || indice === null) return null;
  return fila[indice] === undefined ? null : fila[indice];
}

/**
 * Asigna cada campo a la columna cuyo encabezado se le parece mas.
 * La asignacion es global: una columna no puede alimentar dos campos.
 */
function mapearColumnas(headers) {
  const normalizados = (headers || []).map((header) => normalizar(header));
  const candidatos = [];

  for (const [campo, definicion] of Object.entries(CAMPOS)) {
    normalizados.forEach((headerNorm, indice) => {
      if (!headerNorm) return;

      const puntaje = puntuarCoincidencia(headerNorm, definicion.aliases);
      if (puntaje < UMBRAL_COINCIDENCIA) return;

      candidatos.push({ campo, indice, puntaje });
    });
  }

  candidatos.sort((a, b) => {
    if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
    if (CAMPOS[b.campo].peso !== CAMPOS[a.campo].peso) {
      return CAMPOS[b.campo].peso - CAMPOS[a.campo].peso;
    }
    return a.indice - b.indice;
  });

  const columnas = {};
  const puntajes = {};
  const encabezados = {};
  const usadas = new Set();

  for (const candidato of candidatos) {
    if (columnas[candidato.campo] !== undefined) continue;
    if (usadas.has(candidato.indice)) continue;

    columnas[candidato.campo] = candidato.indice;
    puntajes[candidato.campo] = candidato.puntaje;
    encabezados[candidato.campo] = limpiarTexto(headers[candidato.indice]);
    usadas.add(candidato.indice);
  }

  const pesoTotal = Object.values(CAMPOS).reduce((total, campo) => total + campo.peso, 0);
  const pesoDetectado = Object.entries(columnas)
    .reduce((total, [campo]) => total + CAMPOS[campo].peso, 0);

  return {
    columnas,
    puntajes,
    encabezados,
    cobertura: pesoTotal ? pesoDetectado / pesoTotal : 0,
    faltantes: Object.keys(CAMPOS).filter((campo) => columnas[campo] === undefined)
  };
}

function combinarEncabezados(filaA, filaB) {
  const longitud = Math.max((filaA || []).length, (filaB || []).length);
  const combinados = [];

  for (let indice = 0; indice < longitud; indice++) {
    const arriba = limpiarTexto((filaA || [])[indice]);
    const abajo = limpiarTexto((filaB || [])[indice]);

    if (arriba && abajo && normalizar(arriba) !== normalizar(abajo)) {
      combinados.push(`${arriba} ${abajo}`);
    } else {
      combinados.push(arriba || abajo || '');
    }
  }

  return combinados;
}

/**
 * Una tabla de materiales necesita descripcion y, al menos, dos de las
 * tres columnas numericas: cantidad, precio unitario y total.
 */
function columnasSuficientes(columnas) {
  if (columnas.descripcion === undefined) return false;

  const tieneCantidad = columnas.cantidad !== undefined;
  const tienePrecio = columnas.precio_unitario !== undefined;
  const tieneTotal = columnas.total !== undefined;

  if (tieneCantidad && tienePrecio) return true;
  return tieneTotal && (tieneCantidad || tienePrecio);
}

function puntajeEncabezado(mapeo) {
  const exactos = Object.values(mapeo.puntajes).filter((puntaje) => puntaje >= 0.99).length;
  return mapeo.cobertura + exactos * 0.01;
}

/**
 * Busca la fila de encabezado en las primeras MAX_FILAS_ENCABEZADO filas.
 * Tambien prueba encabezados partidos en dos filas (por ejemplo "Precio"
 * arriba y "Unitario" abajo).
 */
function detectarEncabezado(filas) {
  let mejor = null;
  const limite = Math.min((filas || []).length, MAX_FILAS_ENCABEZADO);

  for (let indice = 0; indice < limite; indice++) {
    const fila = filas[indice] || [];
    const simple = mapearColumnas(fila);

    if (columnasSuficientes(simple.columnas)) {
      const candidato = {
        fila: indice,
        filasEncabezado: 1,
        mapeo: simple,
        puntaje: puntajeEncabezado(simple)
      };

      if (!mejor || candidato.puntaje > mejor.puntaje) mejor = candidato;
      continue;
    }

    if (indice + 1 >= limite) continue;

    const filaSiguiente = filas[indice + 1] || [];
    const filaActualVacia = fila.every((celda) => limpiarTexto(celda) === '');
    const filaSiguienteVacia = filaSiguiente.every((celda) => limpiarTexto(celda) === '');

    if (filaActualVacia || filaSiguienteVacia) continue;

    // Si la fila siguiente ya es un encabezado completo por si sola,
    // no hay razon para fusionarla con la fila actual.
    const siguienteSimple = mapearColumnas(filaSiguiente);
    if (columnasSuficientes(siguienteSimple.columnas)) continue;

    const compuesto = mapearColumnas(combinarEncabezados(fila, filaSiguiente));
    if (!columnasSuficientes(compuesto.columnas)) continue;

    const candidato = {
      fila: indice,
      filasEncabezado: 2,
      mapeo: compuesto,
      puntaje: puntajeEncabezado(compuesto)
    };

    if (!mejor || candidato.puntaje > mejor.puntaje) mejor = candidato;
  }

  return mejor;
}

/* ===== NUMEROS ===== */
function redondear(numero, decimales) {
  const factor = 10 ** decimales;
  return Math.round((numero + Number.EPSILON) * factor) / factor;
}

/**
 * Convierte numeros y textos con formato mexicano/internacional.
 * Acepta "$1,234.56", "1.234,56", "1,234", "0,500" y negativos entre parentesis.
 */
function parseNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'boolean' || valor instanceof Date) return null;

  const original = limpiarTexto(valor);
  if (!original) return null;

  if (/^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(original)) {
    const cientifico = Number(original);
    return Number.isFinite(cientifico) ? cientifico : null;
  }

  const negativo = /^\s*\(.*\)\s*$/.test(original) || /^\s*-/.test(original);
  let texto = original.replace(/[^\d.,]/g, '');

  if (!texto || !/\d/.test(texto)) return null;

  const tienePunto = texto.includes('.');
  const tieneComa = texto.includes(',');
  let normalizado = texto;

  if (tienePunto && tieneComa) {
    if (texto.lastIndexOf('.') > texto.lastIndexOf(',')) {
      normalizado = texto.replace(/,/g, '');
    } else {
      normalizado = texto.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (tieneComa) {
    const partes = texto.split(',');
    const ultima = partes[partes.length - 1];

    if (partes.length > 2) {
      const grupos = partes.slice(1);
      normalizado = grupos.every((grupo) => grupo.length === 3)
        ? partes.join('')
        : `${partes.slice(0, -1).join('')}.${ultima}`;
    } else if (ultima.length === 3 && partes[0] !== '0' && partes[0].length <= 3) {
      normalizado = partes.join('');
    } else {
      normalizado = `${partes[0]}.${ultima}`;
    }
  } else if (tienePunto) {
    const partes = texto.split('.');
    const ultima = partes[partes.length - 1];

    if (partes.length > 2) {
      const grupos = partes.slice(1);
      normalizado = grupos.every((grupo) => grupo.length === 3)
        ? partes.join('')
        : `${partes.slice(0, -1).join('')}.${ultima}`;
    }
  }

  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) return null;
  return negativo ? -numero : numero;
}

/* ===== FECHAS ===== */
const MESES = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  setiembre: 9,
  sep: 9,
  sept: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12
};

function dosDigitos(numero) {
  return String(numero).padStart(2, '0');
}

function formatearFecha(anio, mes, dia) {
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || !Number.isInteger(dia)) return null;
  if (anio < 1900 || anio > 2200 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }

  return `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
}

function fechaDesdeDate(fecha) {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return null;

  const medianocheUtc =
    fecha.getUTCHours() === 0 &&
    fecha.getUTCMinutes() === 0 &&
    fecha.getUTCSeconds() === 0;

  if (medianocheUtc) {
    return formatearFecha(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, fecha.getUTCDate());
  }

  return formatearFecha(fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate());
}

function anioCompleto(anio) {
  if (anio >= 100) return anio;
  return anio < 50 ? 2000 + anio : 1900 + anio;
}

function construirFechaNumerica(parteA, parteB, anio) {
  const a = Number(parteA);
  const b = Number(parteB);
  const y = anioCompleto(Number(anio));

  if (!Number.isInteger(a) || !Number.isInteger(b)) return null;

  let dia;
  let mes;

  if (a > 12 && b <= 12) {
    dia = a;
    mes = b;
  } else if (b > 12 && a <= 12) {
    dia = b;
    mes = a;
  } else {
    dia = a;
    mes = b;
  }

  return formatearFecha(y, mes, dia);
}

/**
 * Convierte Date, serial de Excel y textos en espanol a "YYYY-MM-DD".
 * Si el texto contiene varias fechas, toma la primera.
 */
function parseFecha(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return fechaDesdeDate(valor);

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return null;

    if (Number.isInteger(valor) && valor >= 19000101 && valor <= 22001231) {
      const texto = String(valor);
      return formatearFecha(Number(texto.slice(0, 4)), Number(texto.slice(4, 6)), Number(texto.slice(6, 8)));
    }

    if (valor >= 20000 && valor <= 80000) {
      const fecha = XLSX.SSF.parse_date_code(valor);
      if (fecha && fecha.y && fecha.m && fecha.d) {
        return formatearFecha(fecha.y, fecha.m, fecha.d);
      }
    }

    return null;
  }

  const texto = limpiarTexto(valor);
  if (!texto) return null;

  // Serial de Excel recibido como texto (por ejemplo "45000").
  if (/^\d{5}(?:\.0+)?$/.test(texto)) {
    const serial = Number(texto);
    const fecha = XLSX.SSF.parse_date_code(serial);
    if (fecha && fecha.y && fecha.m && fecha.d) {
      const formateada = formatearFecha(fecha.y, fecha.m, fecha.d);
      if (formateada) return formateada;
    }
  }

  const iso = texto.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    const fecha = formatearFecha(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (fecha) return fecha;
  }

  const numerica = texto.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (numerica) {
    const fecha = construirFechaNumerica(numerica[1], numerica[2], numerica[3]);
    if (fecha) return fecha;
  }

  const compacta = texto.match(/\b(\d{8})\b/);
  if (compacta) {
    const fecha = formatearFecha(
      Number(compacta[1].slice(0, 4)),
      Number(compacta[1].slice(4, 6)),
      Number(compacta[1].slice(6, 8))
    );
    if (fecha) return fecha;
  }

  const normalizado = normalizar(texto);

  const diaMesAnio = normalizado.match(/\b(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+|del\s+)?(\d{2,4})\b/);
  if (diaMesAnio && MESES[diaMesAnio[2]]) {
    return formatearFecha(anioCompleto(Number(diaMesAnio[3])), MESES[diaMesAnio[2]], Number(diaMesAnio[1]));
  }

  const mesDiaAnio = normalizado.match(/\b([a-z]+)\s+(\d{1,2}),?\s+(?:de\s+)?(\d{2,4})\b/);
  if (mesDiaAnio && MESES[mesDiaAnio[1]]) {
    return formatearFecha(anioCompleto(Number(mesDiaAnio[3])), MESES[mesDiaAnio[1]], Number(mesDiaAnio[2]));
  }

  const diaMesTextoAnio = normalizado.match(/\b(\d{1,2})[-\s]([a-z]{3,})[-\s](\d{2,4})\b/);
  if (diaMesTextoAnio && MESES[diaMesTextoAnio[2]]) {
    return formatearFecha(
      anioCompleto(Number(diaMesTextoAnio[3])),
      MESES[diaMesTextoAnio[2]],
      Number(diaMesTextoAnio[1])
    );
  }

  return null;
}

/* ===== METADATOS ===== */
function esEtiquetaDeTabla(texto) {
  const normalizado = normalizar(texto);
  if (!normalizado) return false;

  return Object.values(CAMPOS).some((definicion) => (
    puntuarCoincidencia(normalizado, definicion.aliases) >= UMBRAL_META
  ));
}

function detectarCampoMeta(texto) {
  const normalizado = normalizar(texto);
  if (!normalizado) return null;

  let mejor = null;

  for (const [campo, aliases] of Object.entries(META_ALIASES)) {
    const puntaje = puntuarCoincidencia(normalizado, aliases);
    if (puntaje < UMBRAL_META) continue;
    if (!mejor || puntaje > mejor.puntaje) mejor = { campo, puntaje };
  }

  return mejor ? mejor.campo : null;
}

function esNombreValido(valor) {
  const texto = limpiarTexto(valor);
  if (texto.length < 2 || texto.length > 300) return false;
  if (!/[^\d\s.,$%()\-]/.test(texto)) return false;
  if (esEtiquetaDeTabla(texto)) return false;
  if (detectarCampoMeta(texto)) return false;
  return true;
}

function valorValidoParaCampo(campo, valor) {
  if (campo === 'fecha_inicio') return parseFecha(valor) !== null;

  if (campo === 'presupuesto_total') {
    const numero = parseNumero(valor);
    return numero !== null && numero >= 0;
  }

  if (campo === 'nombre_obra') return esNombreValido(valor);

  return false;
}

/**
 * Extrae el nombre cuando la etiqueta y el valor estan en la misma celda
 * sin dos puntos: "Nombre de obra Casa Demo".
 */
function extraerNombreDeCelda(celda) {
  const tokens = limpiarTexto(celda).split(' ');
  const tokensNormalizados = tokens.map((token) => normalizar(token));
  let mejor = null;

  for (const alias of META_ALIASES.nombre_obra) {
    const tokensAlias = tokenizar(normalizar(alias));
    if (!tokensAlias.length || tokensNormalizados.length <= tokensAlias.length) continue;

    const coincide = tokensAlias.every((token, indice) => tokensNormalizados[indice] === token);
    if (!coincide) continue;

    const resto = tokens
      .slice(tokensAlias.length)
      .join(' ')
      .replace(/^[-:;,.\s]+/, '')
      .trim();

    if (!resto || !esNombreValido(resto)) continue;
    if (!mejor || tokensAlias.length > mejor.longitud) {
      mejor = { valor: resto, longitud: tokensAlias.length };
    }
  }

  return mejor ? mejor.valor : null;
}

/**
 * Interpreta una celda que puede ser etiqueta ("Nombre de obra:") o
 * etiqueta con valor en la misma celda. Si no hay valor a la derecha,
 * revisa hasta tres columnas y luego la celda inferior.
 */
function interpretarCeldaMeta(filas, filaIndice, columnaIndice, filaEncabezado, filasEncabezado, columnasUsadas) {
  const fila = filas[filaIndice] || [];
  const celda = limpiarTexto(fila[columnaIndice]);
  if (!celda) return null;

  const esFilaEncabezado = filaIndice >= filaEncabezado &&
    filaIndice < filaEncabezado + filasEncabezado;

  if (esFilaEncabezado && columnasUsadas.has(columnaIndice)) return null;

  const separador = celda.indexOf(':');
  if (separador > 0) {
    const etiqueta = celda.slice(0, separador).trim();
    const valor = celda.slice(separador + 1).trim();
    const campo = detectarCampoMeta(etiqueta);

    if (campo && valorValidoParaCampo(campo, valor)) return { campo, valor };
  }

  const campo = detectarCampoMeta(celda);
  if (!campo) return null;

  if (campo === 'nombre_obra') {
    const nombre = extraerNombreDeCelda(celda);
    if (nombre) return { campo, valor: nombre };
  }

  // Algunos reportes escriben "Fecha de inicio 15/03/2026" o
  // "Presupuesto total $1,234.56" sin dos puntos.
  if (campo === 'fecha_inicio' && parseFecha(celda)) {
    return { campo, valor: celda };
  }

  if (campo === 'presupuesto_total') {
    const numero = parseNumero(celda);
    if (numero !== null && numero >= 0) return { campo, valor: celda };
  }

  for (let salto = 1; salto <= 3; salto++) {
    const indice = columnaIndice + salto;
    if (indice >= fila.length) break;

    const texto = limpiarTexto(fila[indice]);
    if (!texto) continue;

    if (detectarCampoMeta(texto) || esEtiquetaDeTabla(texto)) break;
    if (valorValidoParaCampo(campo, texto)) return { campo, valor: texto };
  }

  const filaSiguiente = filas[filaIndice + 1];
  if (filaSiguiente) {
    const texto = limpiarTexto(filaSiguiente[columnaIndice]);
    if (
      texto &&
      !detectarCampoMeta(texto) &&
      !esEtiquetaDeTabla(texto) &&
      valorValidoParaCampo(campo, texto)
    ) {
      return { campo, valor: texto };
    }
  }

  return null;
}

function extraerMetadatos(filas, filaEncabezado, filasEncabezado, columnasUsadas) {
  const metadatos = {};
  const limite = Math.min(filas.length, filaEncabezado + filasEncabezado);

  for (let filaIndice = 0; filaIndice < limite; filaIndice++) {
    const fila = filas[filaIndice] || [];

    for (let columnaIndice = 0; columnaIndice < fila.length; columnaIndice++) {
      const encontrado = interpretarCeldaMeta(
        filas,
        filaIndice,
        columnaIndice,
        filaEncabezado,
        filasEncabezado,
        columnasUsadas
      );

      if (!encontrado) continue;
      if (metadatos[encontrado.campo] === undefined) {
        metadatos[encontrado.campo] = encontrado.valor;
      }
    }
  }

  return metadatos;
}

/**
 * Recoge metadatos de una hoja sin exigir que tenga una tabla.
 * Sirve para portadas o resumenes que acompanan a la hoja de materiales.
 */
function extraerMetadatosSueltos(filas) {
  const metadatos = {};
  const limite = Math.min(filas.length, MAX_FILAS_ENCABEZADO);
  const sinColumnas = new Set();

  for (let filaIndice = 0; filaIndice < limite; filaIndice++) {
    const fila = filas[filaIndice] || [];

    for (let columnaIndice = 0; columnaIndice < fila.length; columnaIndice++) {
      const encontrado = interpretarCeldaMeta(
        filas,
        filaIndice,
        columnaIndice,
        -1,
        0,
        sinColumnas
      );

      if (!encontrado) continue;
      if (metadatos[encontrado.campo] === undefined) {
        metadatos[encontrado.campo] = encontrado.valor;
      }
    }
  }

  return metadatos;
}

/* ===== FILAS DE MATERIALES ===== */
const PATRONES_SUBTOTAL = [
  /^sub\s*total\b/,
  /^total\b/,
  /^gran total\b/,
  /^suma\b/,
  /^iva\b/,
  /^impuesto\b/,
  /^importe total\b/,
  /^monto total\b/,
  /^presupuesto\b/,
  /^resumen\b/
];

function esFilaSubtotal(descripcion, cantidad, precio, total) {
  if (cantidad === null && precio === null && total !== null) return true;

  // Una fila con cantidad y precio es un material, aunque su descripcion
  // empiece con "Total". Los patrones solo aplican cuando falta un numerico.
  if (cantidad !== null && precio !== null) return false;

  const normalizado = normalizar(descripcion);
  if (!normalizado) return false;

  return PATRONES_SUBTOTAL.some((patron) => patron.test(normalizado));
}

function formatearNumero(numero) {
  return Number(numero).toFixed(2);
}

/**
 * Convierte las filas posteriores al encabezado en materiales.
 * Omite filas vacias, encabezados de seccion y subtotales.
 */
function combinarFilas(filasDatos, mapeo, filaInicioAbsoluta, advertencias, maxFilas) {
  const columnas = mapeo.columnas;
  const materiales = [];

  let filasLeidas = 0;
  let filasCandidatas = 0;
  let filasInvalidas = 0;
  let secciones = 0;
  let subtotales = 0;
  let sinUnidad = 0;
  let unidadesTruncadas = 0;
  let sinTotal = 0;
  let cantidadesDerivadas = 0;
  let preciosDerivados = 0;
  let sumaTotales = 0;

  const maxFilasNumero = Number(maxFilas);
  const limite = Number.isFinite(maxFilasNumero) && maxFilasNumero > 0
    ? Math.floor(maxFilasNumero)
    : MAX_FILAS_DEFAULT;
  const procesables = Math.min(filasDatos.length, limite);

  if (columnas.total === undefined) {
    advertencias.agregar('No se detecto la columna Total; se calculo cantidad x precio unitario.');
  }

  if (columnas.unidades === undefined) {
    advertencias.agregar('No se detecto la columna Unidad; se uso "pza" como unidad predeterminada.');
  }

  if (filasDatos.length > limite) {
    advertencias.agregar(
      `El archivo tiene ${filasDatos.length} filas de datos; se procesaron solo las primeras ${limite}.`
    );
  }

  for (let indice = 0; indice < procesables; indice++) {
    const fila = filasDatos[indice] || [];
    const filaExcel = filaInicioAbsoluta + indice + 1;

    if (!Array.isArray(fila) || fila.every((celda) => limpiarTexto(celda) === '')) continue;

    filasLeidas++;

    const descripcionCruda = limpiarTexto(valorColumna(fila, columnas.descripcion));
    const cantidadCruda = valorColumna(fila, columnas.cantidad);
    const precioCrudo = valorColumna(fila, columnas.precio_unitario);
    const totalCrudo = valorColumna(fila, columnas.total);

    let cantidad = parseNumero(cantidadCruda);
    let precio = parseNumero(precioCrudo);
    let total = parseNumero(totalCrudo);

    if (cantidad === null && precio === null && total === null) {
      secciones++;
      continue;
    }

    if (esFilaSubtotal(descripcionCruda, cantidad, precio, total)) {
      subtotales++;
      continue;
    }

    filasCandidatas++;

    if (!descripcionCruda) {
      filasInvalidas++;
      advertencias.agregar(`Fila ${filaExcel}: no tiene descripcion; se omitio.`);
      continue;
    }

    if (
      (cantidad === null || cantidad <= 0) &&
      precio !== null &&
      precio > 0 &&
      total !== null &&
      total > 0
    ) {
      cantidad = redondear(total / precio, 3);
      cantidadesDerivadas++;
      advertencias.agregar(
        `Fila ${filaExcel}: la cantidad estaba vacia o era invalida; se calculo como total / precio unitario.`
      );
    }

    if (
      (precio === null || precio <= 0) &&
      cantidad !== null &&
      cantidad > 0 &&
      total !== null &&
      total > 0
    ) {
      precio = redondear(total / cantidad, 2);
      preciosDerivados++;
      advertencias.agregar(
        `Fila ${filaExcel}: el precio unitario estaba vacio o era invalido; se calculo como total / cantidad.`
      );
    }

    if (cantidad === null || cantidad <= 0) {
      filasInvalidas++;
      advertencias.agregar(`Fila ${filaExcel}: la cantidad no es valida; se omitio.`);
      continue;
    }

    if (precio === null || precio < 0) {
      filasInvalidas++;
      advertencias.agregar(`Fila ${filaExcel}: el precio unitario no es valido; se omitio.`);
      continue;
    }

    if (cantidad > MAX_CANTIDAD) {
      filasInvalidas++;
      advertencias.agregar(`Fila ${filaExcel}: la cantidad supera el maximo permitido; se omitio.`);
      continue;
    }

    if (precio > MAX_PRECIO) {
      filasInvalidas++;
      advertencias.agregar(`Fila ${filaExcel}: el precio unitario supera el maximo permitido; se omitio.`);
      continue;
    }

    const calculado = redondear(cantidad * precio, 2);

    if (total === null) {
      total = calculado;
      sinTotal++;
    } else if (total < 0) {
      advertencias.agregar(
        `Fila ${filaExcel}: el total era negativo; se uso cantidad x precio unitario.`
      );
      total = calculado;
    } else {
      const diferencia = Math.abs(total - calculado);
      const tolerancia = Math.max(0.05, calculado * 0.005);

      if (diferencia > tolerancia) {
        advertencias.agregar(
          `Fila ${filaExcel}: el total ${formatearNumero(total)} no coincide con cantidad x precio ` +
          `(${formatearNumero(calculado)}); se uso el total calculado.`
        );
        total = calculado;
      } else {
        total = redondear(total, 2);
      }
    }

    if (total > MAX_TOTAL) {
      filasInvalidas++;
      advertencias.agregar(`Fila ${filaExcel}: el total supera el maximo permitido; se omitio.`);
      continue;
    }

    let descripcion = descripcionCruda;
    if (descripcion.length > MAX_DESCRIPCION) {
      descripcion = descripcion.slice(0, MAX_DESCRIPCION).trim();
      advertencias.agregar(
        `Fila ${filaExcel}: la descripcion supera ${MAX_DESCRIPCION} caracteres; se trunco.`
      );
    }

    let unidad = limpiarTexto(valorColumna(fila, columnas.unidades));
    if (!unidad) {
      unidad = 'pza';
      sinUnidad++;
    } else if (unidad.length > MAX_UNIDADES) {
      unidad = unidad.slice(0, MAX_UNIDADES).trim();
      unidadesTruncadas++;
    }

    materiales.push({
      descripcion,
      unidades: unidad,
      cantidad: redondear(cantidad, 3),
      precio_unitario: redondear(precio, 2),
      total: redondear(total, 2)
    });

    sumaTotales += total;
  }

  const omitidasEspeciales = secciones + subtotales;
  if (omitidasEspeciales > 0) {
    advertencias.agregar(
      omitidasEspeciales === 1
        ? 'Se omitio 1 fila de encabezado de seccion o subtotal.'
        : `Se omitieron ${omitidasEspeciales} filas de encabezados de seccion o subtotales.`
    );
  }

  if (columnas.unidades !== undefined && sinUnidad > 0) {
    advertencias.agregar(
      sinUnidad === 1
        ? 'Se encontro 1 fila sin unidad; se uso "pza".'
        : `Se encontraron ${sinUnidad} filas sin unidad; se uso "pza".`
    );
  }

  if (unidadesTruncadas > 0) {
    advertencias.agregar(
      unidadesTruncadas === 1
        ? `Se trunco 1 unidad que superaba ${MAX_UNIDADES} caracteres.`
        : `Se truncaron ${unidadesTruncadas} unidades que superaban ${MAX_UNIDADES} caracteres.`
    );
  }

  if (columnas.total !== undefined && sinTotal > 0) {
    advertencias.agregar(
      sinTotal === 1
        ? 'Se calculo 1 total a partir de cantidad x precio unitario.'
        : `Se calcularon ${sinTotal} totales a partir de cantidad x precio unitario.`
    );
  }

  if (cantidadesDerivadas > 0) {
    advertencias.agregar(
      cantidadesDerivadas === 1
        ? 'Se derivo 1 cantidad a partir del total y el precio unitario.'
        : `Se derivaron ${cantidadesDerivadas} cantidades a partir del total y el precio unitario.`
    );
  }

  if (preciosDerivados > 0) {
    advertencias.agregar(
      preciosDerivados === 1
        ? 'Se derivo 1 precio unitario a partir del total y la cantidad.'
        : `Se derivaron ${preciosDerivados} precios unitarios a partir del total y la cantidad.`
    );
  }

  return {
    materiales,
    filasLeidas,
    filasCandidatas,
    filasInvalidas,
    filasImportadas: materiales.length,
    filasOmitidas: filasLeidas - materiales.length,
    filasNoProcesadas: Math.max(0, filasDatos.length - procesables),
    sumaTotales: redondear(sumaTotales, 2),
    cobertura: mapeo.cobertura,
    faltantes: mapeo.faltantes,
    encabezados: mapeo.encabezados
  };
}

/* ===== ARMADO DEL RESULTADO ===== */
function crearColectorAdvertencias() {
  const lista = [];
  const vistos = new Set();

  return {
    agregar(mensaje) {
      const texto = limpiarTexto(mensaje);
      if (!texto || vistos.has(texto)) return;
      if (lista.length >= MAX_ADVERTENCIAS) return;

      if (lista.length === MAX_ADVERTENCIAS - 1) {
        const aviso = `Se alcanzo el limite de ${MAX_ADVERTENCIAS} advertencias; puede haber avisos adicionales.`;
        if (!vistos.has(aviso)) {
          vistos.add(aviso);
          lista.push(aviso);
        }
        return;
      }

      vistos.add(texto);
      lista.push(texto);
    },
    lista() {
      return lista.slice();
    }
  };
}

/**
 * Convierte una hoja en una matriz de filas donde el indice 0 corresponde
 * a la fila 1 de Excel, aunque el rango usado empiece mas abajo.
 */
function hojaAFilas(hoja) {
  if (!hoja || !hoja['!ref']) return [];

  let rango;
  try {
    rango = XLSX.utils.decode_range(hoja['!ref']);
  } catch (_error) {
    return [];
  }

  let filas = XLSX.utils.sheet_to_json(hoja, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
    range: {
      s: { r: 0, c: 0 },
      e: { r: rango.e.r, c: Math.min(rango.e.c, MAX_COLUMNAS - 1) }
    }
  });

  if (!Array.isArray(filas)) filas = [];

  while (
    filas.length > 0 &&
    (filas[filas.length - 1] || []).every((celda) => limpiarTexto(celda) === '')
  ) {
    filas.pop();
  }

  return filas;
}

function resolverNombreObra(metadatos, opciones, nombreHoja, advertencias) {
  let nombre = limpiarTexto(metadatos.nombre_obra);

  if (nombre) {
    if (nombre.length > 200) {
      nombre = nombre.slice(0, 200).trim();
      advertencias.agregar('El nombre de la obra supera 200 caracteres; se trunco.');
    }
    return nombre;
  }

  const archivo = limpiarTexto(opciones.nombreArchivo);
  if (archivo) {
    nombre = path.basename(archivo, path.extname(archivo))
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (!nombre) nombre = limpiarTexto(nombreHoja) || 'Importacion Opus';
  if (nombre.length > 200) nombre = nombre.slice(0, 200).trim();

  advertencias.agregar(
    `No se detecto el nombre de la obra; se uso "${nombre}". Puedes editarlo antes de confirmar.`
  );

  return nombre;
}

function resolverFechaInicio(metadatos, advertencias) {
  const valor = metadatos.fecha_inicio;

  if (valor === undefined || valor === null || limpiarTexto(valor) === '') {
    advertencias.agregar('No se detecto la fecha de inicio en el archivo.');
    return null;
  }

  const fecha = parseFecha(valor);
  if (!fecha) {
    advertencias.agregar(
      `No se pudo interpretar la fecha de inicio "${limpiarTexto(valor)}".`
    );
    return null;
  }

  return fecha;
}

function resolverPresupuesto(metadatos, sumaTotales, advertencias) {
  const valor = metadatos.presupuesto_total;
  let declarado = null;

  if (valor !== undefined && valor !== null && limpiarTexto(valor) !== '') {
    declarado = parseNumero(valor);

    if (declarado === null || declarado < 0) {
      advertencias.agregar(
        `No se pudo interpretar el presupuesto total "${limpiarTexto(valor)}"; ` +
        'se uso la suma de materiales.'
      );
      declarado = null;
    }
  } else {
    advertencias.agregar('No se detecto el presupuesto total; se uso la suma de materiales.');
  }

  if (declarado === null) {
    return { presupuesto: redondear(sumaTotales, 2), declarado: null };
  }

  if (declarado === 0 && sumaTotales > 0) {
    advertencias.agregar('El presupuesto total declarado es 0; se uso la suma de materiales.');
    return { presupuesto: redondear(sumaTotales, 2), declarado: 0 };
  }

  const diferencia = Math.abs(declarado - sumaTotales);
  const tolerancia = Math.max(1, sumaTotales * 0.01);

  if (diferencia > tolerancia) {
    advertencias.agregar(
      `El presupuesto total declarado (${formatearNumero(declarado)}) difiere de la suma ` +
      `de materiales (${formatearNumero(sumaTotales)}). Se conservo el presupuesto declarado.`
    );
  }

  return { presupuesto: redondear(declarado, 2), declarado: redondear(declarado, 2) };
}

function calcularConfianza(cobertura, proporcionFilas) {
  const valor = cobertura * 0.7 + proporcionFilas * 0.3;
  return Math.max(0, Math.min(100, Math.round(valor * 100)));
}

function procesarHoja(nombreHoja, filas, opciones, metadatosExternos = {}) {
  const advertencias = crearColectorAdvertencias();
  const encabezado = detectarEncabezado(filas);
  if (!encabezado) return null;

  const columnasUsadas = new Set(Object.values(encabezado.mapeo.columnas));
  const metadatosLocales = extraerMetadatos(
    filas,
    encabezado.fila,
    encabezado.filasEncabezado,
    columnasUsadas
  );
  const metadatos = { ...metadatosExternos, ...metadatosLocales };

  const filaInicio = encabezado.fila + encabezado.filasEncabezado;
  const filasDatos = filas.slice(filaInicio);
  const combinado = combinarFilas(
    filasDatos,
    encabezado.mapeo,
    filaInicio,
    advertencias,
    opciones.maxFilas
  );

  const nombreObra = resolverNombreObra(metadatos, opciones, nombreHoja, advertencias);
  const fechaInicio = resolverFechaInicio(metadatos, advertencias);
  const presupuesto = resolverPresupuesto(metadatos, combinado.sumaTotales, advertencias);

  if (presupuesto.presupuesto > MAX_TOTAL) {
    advertencias.agregar('El presupuesto total supera el maximo permitido por la base de datos.');
  }

  const proporcionFilas = combinado.filasCandidatas > 0
    ? combinado.filasImportadas / combinado.filasCandidatas
    : 0;
  const confianza = calcularConfianza(combinado.cobertura, proporcionFilas);

  const resultado = {
    nombre_obra: nombreObra,
    fecha_inicio: fechaInicio,
    presupuesto_total: presupuesto.presupuesto,
    materiales: combinado.materiales,
    confianza_parseo: confianza,
    advertencias: advertencias.lista(),
    meta: {
      hoja: nombreHoja,
      fila_encabezado: encabezado.fila + 1,
      filas_encabezado: encabezado.filasEncabezado,
      columnas_detectadas: combinado.encabezados,
      columnas_faltantes: combinado.faltantes,
      filas_leidas: combinado.filasLeidas,
      filas_importadas: combinado.filasImportadas,
      filas_omitidas: combinado.filasOmitidas,
      filas_no_procesadas: combinado.filasNoProcesadas,
      filas_candidatas: combinado.filasCandidatas,
      filas_invalidas: combinado.filasInvalidas,
      suma_totales: combinado.sumaTotales,
      presupuesto_declarado: presupuesto.declarado,
      confianza_columnas: Math.round(combinado.cobertura * 100),
      proporcion_filas: Math.round(proporcionFilas * 100)
    }
  };

  return {
    resultado,
    materiales: combinado.materiales,
    confianza
  };
}

/**
 * Parser principal. Recibe el buffer del Excel y devuelve la estructura
 * que consumira el servicio de importacion.
 *
 * @param {Buffer|Uint8Array|ArrayBuffer} buffer
 * @param {{ nombreArchivo?: string, maxFilas?: number }} [opciones]
 * @returns {object}
 */
function parseOpusWorkbook(buffer, opciones = {}) {
  if (!opciones || typeof opciones !== 'object') opciones = {};

  if (buffer === null || buffer === undefined) {
    throw new OpusParseError('El archivo esta vacio.', 'ARCHIVO_VACIO', 400);
  }

  const esBinario = Buffer.isBuffer(buffer) ||
    buffer instanceof Uint8Array ||
    buffer instanceof ArrayBuffer;

  if (!esBinario) {
    throw new OpusParseError('El contenido del archivo no es valido.', 'ARCHIVO_INVALIDO', 400);
  }

  const longitud = typeof buffer.byteLength === 'number' ? buffer.byteLength : buffer.length;

  if (longitud === 0) {
    throw new OpusParseError('El archivo esta vacio.', 'ARCHIVO_VACIO', 400);
  }

  let workbook;
  try {
    const datos = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    workbook = XLSX.read(datos, {
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellText: false
    });
  } catch (_error) {
    throw new OpusParseError(
      'No se pudo leer el archivo Excel. Verifica que no este danado o protegido.',
      'ARCHIVO_INVALIDO',
      400
    );
  }

  if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    throw new OpusParseError('El archivo Excel no contiene hojas.', 'ARCHIVO_INVALIDO', 400);
  }

  const maxFilas = Number(opciones.maxFilas);
  const opcionesNormalizadas = {
    nombreArchivo: limpiarTexto(opciones.nombreArchivo),
    maxFilas: Number.isFinite(maxFilas) && maxFilas > 0 ? Math.floor(maxFilas) : MAX_FILAS_DEFAULT
  };

  const hojas = [];
  const metadatosGlobales = {};

  for (const nombreHoja of workbook.SheetNames) {
    const hoja = workbook.Sheets[nombreHoja];
    if (!hoja || !hoja['!ref']) continue;

    let filas;
    try {
      filas = hojaAFilas(hoja);
    } catch (_error) {
      continue;
    }

    if (!filas.length) continue;

    hojas.push({ nombreHoja, filas });

    const sueltos = extraerMetadatosSueltos(filas);
    for (const [campo, valor] of Object.entries(sueltos)) {
      if (metadatosGlobales[campo] === undefined) {
        metadatosGlobales[campo] = valor;
      }
    }
  }

  let mejor = null;

  for (const { nombreHoja, filas } of hojas) {
    const candidato = procesarHoja(
      nombreHoja,
      filas,
      opcionesNormalizadas,
      metadatosGlobales
    );

    if (!candidato) continue;

    if (!mejor) {
      mejor = candidato;
      continue;
    }

    if (candidato.materiales.length > mejor.materiales.length) {
      mejor = candidato;
      continue;
    }

    if (
      candidato.materiales.length === mejor.materiales.length &&
      candidato.confianza > mejor.confianza
    ) {
      mejor = candidato;
    }
  }

  if (!mejor) {
    throw new OpusParseError(
      'No se encontro una tabla de materiales con columnas reconocibles. ' +
      'Verifica que el archivo incluya Descripcion/Concepto, Cantidad y Precio Unitario.',
      'SIN_ENCABEZADO',
      422
    );
  }

  if (mejor.materiales.length === 0) {
    throw new OpusParseError(
      'Se detecto la tabla, pero no se encontraron materiales validos para importar.',
      'SIN_MATERIALES',
      422
    );
  }

  return mejor.resultado;
}

module.exports = {
  parseOpusWorkbook,
  parseNumero,
  parseFecha,
  normalizar,
  similitud,
  mapearColumnas,
  detectarEncabezado,
  combinarFilas,
  OpusParseError,
  CAMPOS,
  META_ALIASES,
  MAX_FILAS_DEFAULT,
  MAX_ADVERTENCIAS
};
