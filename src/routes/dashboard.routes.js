'use strict';

const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { auth } = require('../middlewares/auth');

const router = express.Router();

router.get('/kpis', auth, dashboardController.kpis);

module.exports = router;
