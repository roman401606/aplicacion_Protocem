'use strict';

const express = require('express');
const proyectoController = require('../controllers/proyecto.controller');
const { auth, requireRol } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

router.get('/', proyectoController.listar);
router.get('/:id', proyectoController.obtener);
router.post('/', requireRol('administrador'), proyectoController.crear);
router.put('/:id/avance', requireRol('administrador', 'encargado'), proyectoController.actualizarAvance);
router.delete('/:id', requireRol('administrador'), proyectoController.eliminar);

module.exports = router;
