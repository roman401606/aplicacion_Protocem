'use strict';

const express = require('express');
const catalogoController = require('../controllers/catalogo.controller');
const { auth, requireRol } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

router.get('/', catalogoController.listar);
router.get('/especialidades', catalogoController.especialidades);
router.get('/fasar', catalogoController.fasar);
router.post('/', requireRol('administrador'), catalogoController.crear);
router.put('/:id', requireRol('administrador'), catalogoController.actualizar);

module.exports = router;
