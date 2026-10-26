'use strict';

const dashboardService = require('../services/dashboard.service');
const { asyncHandler } = require('../utils/http');

exports.kpis = asyncHandler(async (req, res) => {
  res.json(await dashboardService.obtenerKpis());
});
