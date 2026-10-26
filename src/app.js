'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('../config');
const apiRoutes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(cors({ origin: config.cors.origin }));
app.use(express.json());
app.use(express.static(config.publicDir));

app.use('/api', apiRoutes);

// Fallback SPA: conserva el comportamiento actual para rutas no-API.
app.get('*', (_req, res) => {
  res.sendFile(path.join(config.publicDir, 'index.html'));
});

app.use(errorHandler);

module.exports = app;
