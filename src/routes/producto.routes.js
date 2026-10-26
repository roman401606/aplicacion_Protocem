'use strict';

const express = require('express');
const productoController = require('../controllers/producto.controller');
const { auth, requireRol } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

router.get('/', productoController.listar);
router.post('/', requireRol('administrador'), productoController.crear);

module.exports = router;
