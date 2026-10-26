'use strict';

const express = require('express');
const partidaController = require('../controllers/partida.controller');
const { auth, requireRol } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

router.get('/proyecto/:id', partidaController.listarPorProyecto);
router.post('/proyecto/:id', requireRol('administrador', 'encargado'), partidaController.crear);
router.get('/proyecto/:id/explosion', partidaController.explosion);
router.get('/proyecto/:id/resumen', partidaController.resumen);

router.get('/:id_partida/conceptos', partidaController.listarConceptos);
router.post('/:id_partida/conceptos', requireRol('administrador', 'encargado'), partidaController.crearConcepto);
router.put('/conceptos/:id_concepto', requireRol('administrador', 'encargado'), partidaController.actualizarConcepto);
router.delete('/conceptos/:id_concepto', requireRol('administrador'), partidaController.eliminarConcepto);

router.get('/conceptos/:id_concepto/apu', partidaController.obtenerApu);
router.post('/conceptos/:id_concepto/apu/material', requireRol('administrador', 'encargado'), partidaController.crearApuMaterial);
router.post('/conceptos/:id_concepto/apu/mano-obra', requireRol('administrador', 'encargado'), partidaController.crearApuManoObra);
router.post('/conceptos/:id_concepto/apu/maquinaria', requireRol('administrador', 'encargado'), partidaController.crearApuMaquinaria);

router.get('/conceptos/:id_concepto/generadores', partidaController.listarGeneradores);
router.post('/conceptos/:id_concepto/generadores', requireRol('administrador', 'encargado'), partidaController.crearGenerador);

router.put('/:id_partida', requireRol('administrador', 'encargado'), partidaController.actualizar);
router.delete('/:id_partida', requireRol('administrador'), partidaController.eliminar);

module.exports = router;
