'use strict';

const express = require('express');
const estimacionController = require('../controllers/estimacion.controller');
const { auth, requireRol } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

router.get('/proyecto/:id', estimacionController.listarPorProyecto);
router.get('/proyecto/:id/acumulado', estimacionController.acumulado);
router.post('/proyecto/:id', requireRol('administrador', 'encargado'), estimacionController.crear);
router.get('/:id', estimacionController.obtener);
router.put('/:id/estado', requireRol('administrador'), estimacionController.actualizarEstado);

module.exports = router;
