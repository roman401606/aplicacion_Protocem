'use strict';

const config = require('./config');
const app = require('./src/app');
const { initDB } = require('./src/config/database');

// Render asigna el puerto dinamicamente en process.env.PORT.
// 0.0.0.0 permite recibir trafico del balanceador de Render.
const PORT = process.env.PORT || config.port || 3000;

process.on('unhandledRejection', reason => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', error => {
  console.error('[uncaughtException]', error);
});

initDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n=========================================');
      console.log(`Protocem App escuchando en el puerto ${PORT}`);
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
