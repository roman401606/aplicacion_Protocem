'use strict';

const express = require('express');
const importacionController = require('../controllers/importacion.controller');
const { uploadExcel } = require('../middlewares/uploadExcel');
const { auth, requireRol } = require('../middlewares/auth');

const router = express.Router();

// El importador esta reservado exclusivamente al rol administrador.
router.use(auth, requireRol('administrador'));

router.post(
  '/preview',
  uploadExcel.single('archivo'),
  importacionController.preview
);

router.post('/confirmar', importacionController.confirmar);
router.delete('/:id', importacionController.descartar);

module.exports = router;
