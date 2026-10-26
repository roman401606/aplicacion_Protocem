'use strict';

const authService = require('../services/auth.service');
const { asyncHandler } = require('../utils/http');

exports.login = asyncHandler(async (req, res) => {
  res.json(await authService.login(req.body));
});
