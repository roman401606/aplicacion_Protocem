'use strict';

const express = require('express');
const compraController = require('../controllers/compra.controller');
const { auth, requireRol } = require('../middlewares/auth');

const router = express.Router();
router.use(auth);

router.get('/', compraController.listar);
router.post('/', requireRol('administrador', 'encargado'), compraController.crear);

module.exports = router;
