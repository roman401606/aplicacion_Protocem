require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initDB } = require('./db/database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/proyectos',   require('./routes/proyectos'));
app.use('/api/partidas',    require('./routes/partidas'));
app.use('/api/estimaciones',require('./routes/estimaciones'));
app.use('/api/catalogo',    require('./routes/catalogo'));
app.use('/api',             require('./routes/api'));

app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

const PORT = process.env.PORT || 3000;

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log('\n=========================================');
      console.log(' Protocem App -> http://localhost:' + PORT);
      console.log('=========================================');
      console.log(' Usuarios de prueba:');
      console.log('  admin@protocem.mx      / admin123');
      console.log('  encargado@protocem.mx  / encargado123');
      console.log('  velador@protocem.mx    / lector123');
      console.log('=========================================\n');
    });
  })
  .catch(err => {
    console.error('\n[ERROR] No se pudo conectar a MySQL:', err.message);
    process.exit(1);
  });
