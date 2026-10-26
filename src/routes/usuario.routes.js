'use strict';

const express = require('express');
const usuarioController = require('../controllers/usuario.controller');
const { auth, requireRol } = require('../middlewares/auth');

const router = express.Router();
router.use(auth, requireRol('administrador'));

router.get('/', usuarioController.listar);
router.post('/', usuarioController.crear);

module.exports = router;
