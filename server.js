'use strict';

const config = require('./config');
const app = require('./src/app');
const { initDB } = require('./src/config/database');

// Render asigna el puerto dinamicamente en process.env.PORT.
// config.js lo normaliza; 3000 es solo el fallback para desarrollo local.
const PORT = config.port;

process.on('unhandledRejection', reason => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', error => {
  console.error('[uncaughtException]', error);
});

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log('\n=========================================');
      console.log(' Protocem App escuchando en el puerto ' + PORT);
      console.log('=========================================');
      console.log(' Usuarios de prueba:');
      console.log('  admin@protocem.mx      / admin123');
      console.log('  encargado@protocem.mx  / encargado123');
      console.log('  velador@protocem.mx    / lector123');
      console.log('=========================================\n');
    });
  })
  .catch(error => {
    console.error('\n[ERROR] No se pudo conectar a MySQL:', error.message);
    process.exit(1);
  });
