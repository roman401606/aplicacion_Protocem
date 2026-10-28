'use strict';

/**
 * Configuracion central de la aplicacion.
 *
 * Toda la configuracion sensible o dependiente del entorno se lee aqui.
 * Ningun otro modulo debe usar process.env directamente.
 *
 * Conexion a MySQL:
 *   - Variables individuales: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
 *   - URL unificada: DATABASE_URL (tiene prioridad sobre las variables DB_*).
 *
 * SSL para entornos en la nube:
 *   - DB_SSL: true | false | required | verify-ca | verify-identity
 *   - DB_SSL_REJECT_UNAUTHORIZED: true | false (true por defecto)
 *   - DB_SSL_CA: ruta al certificado CA o PEM en la propia variable
 *   - DATABASE_URL acepta ?ssl=true, ?sslmode=require o ?ssl={"rejectUnauthorized":false}
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

const JWT_SECRET_PLACEHOLDER = 'dev-only-cambia-esta-clave-antes-de-produccion';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'si']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled', 'disable']);
const SSL_TRUE_VALUES = new Set([...TRUE_VALUES, 'required', 'require']);
const SSL_VERIFY_CA = new Set(['verify-ca', 'verify_ca']);
const SSL_VERIFY_IDENTITY = new Set(['verify-identity', 'verify_identity']);

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return TRUE_VALUES.has(String(value).trim().toLowerCase());
}

/**
 * Normaliza el valor SSL de DB_SSL o de la URL.
 * Devuelve undefined cuando no se especifico, o un objeto con la intencion.
 */
function parseSslFlag(value) {
  if (value === undefined || value === null || value === '') return undefined;

  const raw = String(value).trim();
  const normalized = raw.toLowerCase();

  if (SSL_TRUE_VALUES.has(normalized)) return { enabled: true };
  if (FALSE_VALUES.has(normalized)) return { enabled: false };
  if (SSL_VERIFY_CA.has(normalized)) return { enabled: true, verifyCa: true };
  if (SSL_VERIFY_IDENTITY.has(normalized)) return { enabled: true, verifyIdentity: true };

  // PlanetScale y otros proveedores entregan un JSON en el parametro ssl.
  if (raw.startsWith('{')) {
    try {
      return { enabled: true, options: JSON.parse(raw) };
    } catch (_error) {
      throw new Error('El parametro SSL de DATABASE_URL no contiene un JSON valido.');
    }
  }

  throw new Error(
    `Valor SSL no reconocido: "${value}". Usa true, false, required, verify-ca o verify-identity.`
  );
}

function parseSslFromUrl(searchParams) {
  for (const key of ['ssl', 'sslmode', 'ssl-mode', 'ssl_mode']) {
    if (searchParams.has(key)) return parseSslFlag(searchParams.get(key));
  }
  return undefined;
}

function parseDatabaseUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch (_error) {
    throw new Error(
      'DATABASE_URL no es una URL valida. Formato esperado: mysql://usuario:contrasena@host:3306/base_de_datos'
    );
  }

  if (url.protocol !== 'mysql:' && url.protocol !== 'mysql2:') {
    throw new Error('DATABASE_URL debe usar el esquema mysql:// o mysql2://.');
  }

  if (!url.hostname) {
    throw new Error('DATABASE_URL debe incluir el host de MySQL.');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (!database) {
    throw new Error('DATABASE_URL debe incluir el nombre de la base de datos.');
  }

  return {
    host: url.hostname,
    port: toInt(url.port, 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    ssl: parseSslFromUrl(url.searchParams)
  };
}

function readSslCa(value) {
  if (!value) return undefined;

  const texto = String(value).trim();
  if (texto.includes('BEGIN CERTIFICATE')) {
    return texto.replace(/\\n/g, '\n');
  }

  const ruta = path.isAbsolute(texto) ? texto : path.join(__dirname, texto);
  if (!fs.existsSync(ruta)) {
    throw new Error(`DB_SSL_CA apunta a un archivo que no existe: ${ruta}`);
  }

  return fs.readFileSync(ruta, 'utf8');
}

function buildSslConfig(urlSsl) {
  const flag = urlSsl !== undefined ? urlSsl : parseSslFlag(process.env.DB_SSL);

  if (!flag || !flag.enabled) return undefined;

  const options = { ...(flag.options || {}) };
  const ca = readSslCa(process.env.DB_SSL_CA);

  if (ca && options.ca === undefined) options.ca = ca;

  if (options.rejectUnauthorized === undefined) {
    options.rejectUnauthorized = flag.rejectUnauthorized !== undefined
      ? flag.rejectUnauthorized
      : toBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, true);
  }

  if (flag.verifyCa && options.checkServerIdentity === undefined) {
    options.checkServerIdentity = () => undefined;
  }

  return options;
}

function buildDatabaseConfig() {
  const fromUrl = process.env.DATABASE_URL
    ? parseDatabaseUrl(process.env.DATABASE_URL)
    : null;

  return {
    host: fromUrl ? fromUrl.host : (process.env.DB_HOST || '127.0.0.1'),
    port: fromUrl ? fromUrl.port : toInt(process.env.DB_PORT, 3306),
    user: fromUrl ? fromUrl.user : (process.env.DB_USER || 'root'),
    password: fromUrl ? fromUrl.password : (process.env.DB_PASSWORD || ''),
    database: fromUrl ? fromUrl.database : (process.env.DB_NAME || 'protocem_db'),
    waitForConnections: true,
    connectionLimit: toInt(process.env.DB_POOL_SIZE, 10),
    timezone: '+00:00',
    ssl: buildSslConfig(fromUrl ? fromUrl.ssl : undefined)
  };
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error(
    'JWT_SECRET no esta definido. Crea un archivo .env a partir de .env.example.'
  );
}

if (isProduction && (jwtSecret === JWT_SECRET_PLACEHOLDER || jwtSecret.length < 32)) {
  throw new Error(
    'JWT_SECRET debe ser una clave aleatoria de al menos 32 caracteres en produccion.'
  );
}

const corsOrigin = process.env.CORS_ORIGIN || '*';

module.exports = {
  env,
  isProduction,
  // Render inyecta PORT dinamicamente; 3000 se usa solo en local.
  port: toInt(process.env.PORT, 3000),
  publicDir: path.join(__dirname, 'public'),
  uploadsDir: path.join(__dirname, 'uploads'),
  uploadsMaxSize: toInt(process.env.UPLOADS_MAX_SIZE, 10 * 1024 * 1024),
  importPreviewDir: path.join(__dirname, 'uploads', 'importaciones'),
  importPreviewTtlMs: toInt(process.env.IMPORT_PREVIEW_TTL_MS, 60 * 60 * 1000),
  importMaxRows: toInt(process.env.IMPORT_MAX_ROWS, 5000),
  bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 10),
  databaseSource: process.env.DATABASE_URL ? 'DATABASE_URL' : 'DB_*',
  db: buildDatabaseConfig(),
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  },
  cors: {
    origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(s => s.trim())
  }
};
