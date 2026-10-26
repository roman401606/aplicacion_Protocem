const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { pool } = require('../db/database');

router.post('/login', async (req, res) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena)
    return res.status(400).json({ error: 'Correo y contrasena requeridos' });
  try {
    const [rows] = await pool.query(
      'SELECT * FROM USUARIO WHERE correo=? AND activo=1', [correo]
    );
    if (!rows.length) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const user = rows[0];
    const ok   = await bcrypt.compare(contrasena, user.contrasena_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign(
      { id: user.id_usuario, nombre: user.nombre_usuario, correo: user.correo, rol: user.rol },
      process.env.JWT_SECRET, { expiresIn: '8h' }
    );
    res.json({ token, nombre: user.nombre_usuario, rol: user.rol, correo: user.correo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
