const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { res.status(403).json({ error: 'Token invalido o expirado' }); }
}

function requireRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol))
      return res.status(403).json({ error: 'Sin permisos' });
    next();
  };
}

module.exports = { auth, requireRol };
