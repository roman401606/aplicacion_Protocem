'use strict';

const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/proyectos', require('./proyecto.routes'));
router.use('/partidas', require('./partida.routes'));
router.use('/estimaciones', require('./estimacion.routes'));
router.use('/catalogo', require('./catalogo.routes'));
router.use('/compras', require('./compra.routes'));
router.use('/salidas', require('./salida.routes'));
router.use('/productos', require('./producto.routes'));
router.use('/cotizaciones', require('./cotizacion.routes'));
router.use('/proveedores', require('./proveedor.routes'));
router.use('/usuarios', require('./usuario.routes'));
router.use('/importacion', require('./importacion.routes'));

module.exports = router;
