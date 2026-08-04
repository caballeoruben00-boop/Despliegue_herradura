const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

const login = async (req, res) => {
  // El campo puede llegar como "username" (compatibilidad con el frontend
  // actual) o como "identifier". Acepta usuario, número de empleado o correo.
  const identificador = (req.body.identifier ?? req.body.username ?? '').trim();
  const { password } = req.body;

  try {
    console.log('Intento de login con identificador:', identificador);

    if (!identificador || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
    }

    const usuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          { username: identificador },
          { numeroEmpleado: identificador },
          { email: { equals: identificador, mode: 'insensitive' } },
        ],
      },
    });

    if (!usuario) {
      console.log('❌ Usuario no existe:', identificador);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    console.log('✓ Usuario encontrado:', usuario.username);
    console.log('Estado activo:', usuario.activo);

    if (!usuario.activo) {
      console.log('❌ Usuario inactivo:', usuario.username);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);
    console.log('Contraseña válida:', passwordValida);

    if (!passwordValida) {
      console.log('❌ Contraseña incorrecta para:', usuario.username);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { 
        id: usuario.id, 
        username: usuario.username, 
        rol: usuario.rol, 
        nombre: usuario.nombre,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log('✓ Login exitoso para:', usuario.username);

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        username: usuario.username,
        email: usuario.email,
        rol: usuario.rol,
      }
    });

  } catch (error) {
    console.error('Error login:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { login };
