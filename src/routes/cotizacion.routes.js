'use strict';

const express = require('express');
const cotizacionController = require('../controllers/cotizacion.controller');
const { auth, requireRol } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

router.get('/catalogo', cotizacionController.catalogo);
router.get('/', cotizacionController.listar);
router.post('/', requireRol('administrador', 'encargado'), cotizacionController.crear);

module.exports = router;
