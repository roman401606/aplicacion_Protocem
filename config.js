'use strict';

/**
 * Configuracion central de la aplicacion.
 *
 * Toda la configuracion sensible o dependiente del entorno se lee aqui.
 * Ningun otro modulo debe usar process.env directamente.
 */

const path = require('path');
require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'si'].includes(String(value).toLowerCase());
}

function parseDatabaseUrl(value) {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: toInt(url.port, 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '')
  };
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
    ssl: toBool(process.env.DB_SSL, false) ? { rejectUnauthorized: false } : undefined
  };
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error(
    'JWT_SECRET no esta definido. Crea un archivo .env a partir de .env.example.'
  );
}

const corsOrigin = process.env.CORS_ORIGIN || '*';

module.exports = {
  env,
  isProduction,
  port: toInt(process.env.PORT, 3000),
  publicDir: path.join(__dirname, 'public'),
  uploadsDir: path.join(__dirname, 'uploads'),
  uploadsMaxSize: toInt(process.env.UPLOADS_MAX_SIZE, 10 * 1024 * 1024),
  importPreviewDir: path.join(__dirname, 'uploads', 'importaciones'),
  importPreviewTtlMs: toInt(process.env.IMPORT_PREVIEW_TTL_MS, 60 * 60 * 1000),
  importMaxRows: toInt(process.env.IMPORT_MAX_ROWS, 5000),
  bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 10),
  db: buildDatabaseConfig(),
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  },
  cors: {
    origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(s => s.trim())
  }
};
