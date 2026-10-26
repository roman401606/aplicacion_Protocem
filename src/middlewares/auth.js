'use strict';

const jwt = require('jsonwebtoken');
const config = require('../../config');

/**
 * Verifica el JWT enviado en Authorization: Bearer <token>.
 */
function auth(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch {
    res.status(403).json({ error: 'Token invalido o expirado' });
  }
}

/**
 * Restringe el acceso a los roles indicados.
 */
function requireRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    next();
  };
}

module.exports = { auth, requireRol };
