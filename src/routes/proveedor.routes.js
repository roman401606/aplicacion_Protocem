'use strict';

const express = require('express');
const proveedorController = require('../controllers/proveedor.controller');
const { auth, requireRol } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

router.get('/', proveedorController.listar);
router.post('/', requireRol('administrador'), proveedorController.crear);

module.exports = router;
