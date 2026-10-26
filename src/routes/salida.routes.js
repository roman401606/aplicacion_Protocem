'use strict';

const express = require('express');
const salidaController = require('../controllers/salida.controller');
const { auth, requireRol } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

router.get('/', salidaController.listar);
router.post('/', requireRol('administrador', 'encargado'), salidaController.crear);

module.exports = router;
