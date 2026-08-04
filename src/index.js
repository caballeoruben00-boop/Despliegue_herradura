const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const usuarioRoutes = require('./routes/usuario.routes');
const tareaRoutes = require('./routes/tarea.routes');
const reporteRoutes = require('./routes/reporte.routes');
const notificacionRoutes = require('./routes/notificacion.routes');
const { iniciarJobVencimientos } = require('./jobs/vencimientos.job');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Archivos de evidencias (fotos/documentos adjuntos a tareas)
app.use('/uploads/evidencias', express.static(path.join(__dirname, 'uploads', 'evidencias')));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/tareas', tareaRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/notificaciones', notificacionRoutes);

app.get('/', (req, res) => {
  res.json({ mensaje: 'API Herradura funcionando correctamente' });
});

// Manejo de errores de Multer (archivo muy grande, tipo no permitido, etc.)
// Debe ir después de las rutas para capturar los errores que lancen.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Cada archivo debe pesar máximo 10 MB' });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Máximo 5 archivos por solicitud' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message?.includes('no permitido')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  // Revisa tareas próximas a vencer / atrasadas y notifica a los
  // empleados asignados. Se ejecuta una vez al iniciar y luego cada
  // 15 minutos.
  iniciarJobVencimientos();
});