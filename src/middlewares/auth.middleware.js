const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

const verificarToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // La sesión debe seguir existiendo en la base de datos: si fue
    // cerrada (logout) o desalojada (límite de 2 dispositivos), el
    // token ya no es válido aunque su firma siga siendo correcta.
    if (decoded.jti) {
      const sesion = await prisma.sesionActiva.findUnique({ where: { jti: decoded.jti } });
      if (!sesion) {
        return res.status(401).json({ error: 'Sesión cerrada. Inicia sesión de nuevo.' });
      }
      prisma.sesionActiva.update({
        where: { jti: decoded.jti },
        data: { ultimaActividad: new Date() },
      }).catch(() => {});
    }

    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  next();
};

module.exports = { verificarToken, soloAdmin };
