const prisma    = require('../prismaClient');
const puppeteer = require('puppeteer');
const path      = require('path');
const fs        = require('fs');

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── Utilidad: carga el logo como base64 ────────────────────────
// Busca el logo en varias rutas posibles para que no rompa si cambia
// la ubicación del archivo.
function cargarLogoBase64() {
  const rutas = [
    path.join(__dirname, '../assets/images.jpg'),
    path.join(__dirname, '../assets/logo.jpg'),
    path.join(__dirname, '../assets/logo.png'),
    path.join(__dirname, '../../assets/img/logo.png'),
    path.join(__dirname, '../../assets/img/Logo_1.png'),
  ];

  for (const ruta of rutas) {
    if (fs.existsSync(ruta)) {
      const ext  = path.extname(ruta).slice(1).replace('jpg', 'jpeg');
      const b64  = fs.readFileSync(ruta).toString('base64');
      return `data:image/${ext};base64,${b64}`;
    }
  }

  // Fallback: cuadrado gris si no se encuentra ningún logo
  console.warn('⚠️  No se encontró el logo para el PDF. Usando placeholder.');
  return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
}

// ─── Utilidad: genera el HTML del reporte ───────────────────────
function generarHTML(reporte, logoSrc, fechaHora) {
  const nombreMes    = MESES[reporte.mes - 1];
  const total        = reporte.totalTareas;
  const completadoPct = total > 0 ? Math.round((reporte.completadas / total) * 100) : 0;
  const pendientePct  = total > 0 ? Math.round((reporte.pendientes  / total) * 100) : 0;
  const atrasadoPct   = total > 0 ? Math.round((reporte.atrasadas   / total) * 100) : 0;

  const tasaATiempoPct = reporte.completadas > 0
    ? Math.round((reporte.completadasATiempo / reporte.completadas) * 100)
    : null;

  const horas = reporte.tiempoPromedioResolucionHrs;
  const tiempoPromedioTexto = horas == null
    ? '—'
    : horas < 24
      ? `${horas.toFixed(1)} h`
      : `${(horas / 24).toFixed(1)} días`;

  // SVG pie chart (donut con stroke-dasharray)
  const pieSegmentos = total === 0
    ? `<circle cx="21" cy="21" r="15.9" fill="none" stroke="#e5e7eb" stroke-width="10"/>`
    : (() => {
        const c = (reporte.completadas / total) * 100;
        const p = (reporte.pendientes  / total) * 100;
        const a = (reporte.atrasadas   / total) * 100;
        return `
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="#22c55e" stroke-width="10"
            stroke-dasharray="${c} ${100 - c}" stroke-dashoffset="${125 - 0}"/>
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f59e0b" stroke-width="10"
            stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${125 - c}"/>
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="#ef4444" stroke-width="10"
            stroke-dasharray="${a} ${100 - a}" stroke-dashoffset="${125 - c - p}"/>`;
      })();

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; color: #333; }

  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%,-50%);
    opacity: 0.07; z-index: -1;
  }
  .watermark img { width: 380px; }

  .header {
    background: linear-gradient(135deg,#c8860a,#2d7a2d);
    color: white; padding: 20px 30px;
    display: flex; align-items: center; gap: 20px;
  }
  .header img {
    width: 70px; height: 70px; object-fit: contain;
    background: white; border-radius: 8px; padding: 4px;
  }
  .header h1 { font-size: 21px; }
  .header p  { font-size: 12px; opacity: .9; margin-top: 4px; }

  .content { padding: 25px 30px; }

  .info-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 12px; margin-bottom: 22px;
  }
  .info-box {
    background: #f9f9f9; border-left: 4px solid #c8860a;
    padding: 11px 14px; border-radius: 4px;
  }
  .info-box label { font-size: 10px; color: #888; text-transform: uppercase; display: block; }
  .info-box p     { font-size: 15px; font-weight: bold; margin-top: 2px; }

  .stats-grid {
    display: grid; grid-template-columns: repeat(4,1fr);
    gap: 10px; margin-bottom: 14px;
  }
  .stat-card { text-align:center; padding:14px 8px; border-radius:8px; color:white; }
  .stat-card.total       { background:#3b82f6; }
  .stat-card.completadas { background:#22c55e; }
  .stat-card.pendientes  { background:#f59e0b; }
  .stat-card.atrasadas   { background:#ef4444; }
  .stat-card .num   { font-size:30px; font-weight:bold; }
  .stat-card .lbl   { font-size:11px; opacity:.9; margin-top:2px; }

  .stats-grid-secondary {
    display: grid; grid-template-columns: repeat(2,1fr);
    gap: 10px; margin-bottom: 26px;
  }
  .stat-card.ontime      { background:#0ea5e9; }
  .stat-card.avgtime     { background:#8b5cf6; }

  .charts { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:22px; }
  .chart-box { background:#f9f9f9; border-radius:8px; padding:14px; }
  .chart-box h3 { font-size:12px; color:#666; text-align:center; margin-bottom:12px; }

  .bar-chart { display:flex; flex-direction:column; gap:10px; }
  .bar-row   { display:flex; align-items:center; gap:8px; }
  .bar-label { width:85px; font-size:11px; text-align:right; color:#555; }
  .bar-track { flex:1; background:#e5e7eb; border-radius:4px; height:20px; overflow:hidden; }
  .bar-fill  { height:100%; border-radius:4px; display:flex; align-items:center;
               padding-left:6px; font-size:10px; color:white; font-weight:bold; min-width:24px; }
  .bar-fill.c { background:#22c55e; }
  .bar-fill.p { background:#f59e0b; }
  .bar-fill.a { background:#ef4444; }

  .pie-wrap   { display:flex; flex-direction:column; align-items:center; gap:10px; }
  .pie-legend { display:flex; flex-direction:column; gap:6px; width:100%; }
  .leg-item   { display:flex; align-items:center; gap:8px; font-size:11px; }
  .leg-dot    { width:11px; height:11px; border-radius:50%; flex-shrink:0; }

  .footer {
    border-top:1px solid #e5e7eb; padding:10px 30px;
    display:flex; justify-content:space-between;
    font-size:10px; color:#aaa;
  }
</style>
</head>
<body>

<div class="watermark"><img src="${logoSrc}"/></div>

<div class="header">
  <img src="${logoSrc}"/>
  <div>
    <h1>Reporte Mensual de Actividades</h1>
    <p>Distribuidora de Semillas y Productos del Campo "La Herradura" S.A. de C.V.</p>
  </div>
</div>

<div class="content">

  <div class="info-grid">
    <div class="info-box">
      <label>Período</label>
      <p>${nombreMes} ${reporte.anio}</p>
    </div>
    <div class="info-box">
      <label>Empleado</label>
      <p>${reporte.empleado?.nombre ?? 'Todos los empleados'}</p>
    </div>
    <div class="info-box">
      <label>Número de empleado</label>
      <p>${reporte.empleado?.numeroEmpleado ?? '—'}</p>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card total">
      <div class="num">${reporte.totalTareas}</div><div class="lbl">Total Tareas</div>
    </div>
    <div class="stat-card completadas">
      <div class="num">${reporte.completadas}</div><div class="lbl">Completadas</div>
    </div>
    <div class="stat-card pendientes">
      <div class="num">${reporte.pendientes}</div><div class="lbl">Pendientes</div>
    </div>
    <div class="stat-card atrasadas">
      <div class="num">${reporte.atrasadas}</div><div class="lbl">Atrasadas</div>
    </div>
  </div>

  <div class="stats-grid-secondary">
    <div class="stat-card ontime">
      <div class="num">${tasaATiempoPct == null ? '—' : tasaATiempoPct + '%'}</div>
      <div class="lbl">Completadas a tiempo</div>
    </div>
    <div class="stat-card avgtime">
      <div class="num">${tiempoPromedioTexto}</div>
      <div class="lbl">Tiempo promedio de resolución</div>
    </div>
  </div>

  <div class="charts">
    <div class="chart-box">
      <h3>Distribución por estado</h3>
      <div class="bar-chart">
        <div class="bar-row">
          <span class="bar-label">Completadas</span>
          <div class="bar-track">
            <div class="bar-fill c" style="width:${completadoPct}%">${completadoPct}%</div>
          </div>
        </div>
        <div class="bar-row">
          <span class="bar-label">Pendientes</span>
          <div class="bar-track">
            <div class="bar-fill p" style="width:${pendientePct}%">${pendientePct}%</div>
          </div>
        </div>
        <div class="bar-row">
          <span class="bar-label">Atrasadas</span>
          <div class="bar-track">
            <div class="bar-fill a" style="width:${atrasadoPct}%">${atrasadoPct}%</div>
          </div>
        </div>
      </div>
    </div>

    <div class="chart-box">
      <h3>Proporción de tareas</h3>
      <div class="pie-wrap">
        <svg width="110" height="110" viewBox="0 0 42 42">
          ${pieSegmentos}
        </svg>
        <div class="pie-legend">
          <div class="leg-item"><div class="leg-dot" style="background:#22c55e"></div>Completadas (${completadoPct}%)</div>
          <div class="leg-item"><div class="leg-dot" style="background:#f59e0b"></div>Pendientes (${pendientePct}%)</div>
          <div class="leg-item"><div class="leg-dot" style="background:#ef4444"></div>Atrasadas (${atrasadoPct}%)</div>
        </div>
      </div>
    </div>
  </div>

</div>

<div class="footer">
  <span>Distribuidora de Semillas y Productos del Campo "La Herradura" S.A. de C.V.</span>
  <span>Generado el: ${fechaHora}</span>
</div>

</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────
// CONTROLADORES
// ─────────────────────────────────────────────────────────────────

// ── POST /api/reportes ───────────────────────────────────────────
const generarReporte = async (req, res) => {
  const { mes, anio, empleadoId } = req.body;

  if (!mes || !anio) {
    return res.status(400).json({ error: 'Los campos mes y anio son obligatorios' });
  }

  const mesN  = parseInt(mes);
  const anioN = parseInt(anio);

  if (mesN < 1 || mesN > 12) return res.status(400).json({ error: 'El mes debe ser entre 1 y 12' });

  try {
    const where = {
      creadoEn: {
        gte: new Date(anioN, mesN - 1, 1),
        lt:  new Date(anioN, mesN,     1),
      },
    };

    if (empleadoId) where.asignadoAId = parseInt(empleadoId);

    const tareas = await prisma.tarea.findMany({ where });

    const totalTareas = tareas.length;
    const completadas = tareas.filter(t => t.estado === 'COMPLETADA').length;
    const pendientes  = tareas.filter(t => t.estado === 'PENDIENTE').length;
    const atrasadas   = tareas.filter(t => t.estado === 'ATRASADA').length;

    // Tareas completadas que sí registran fecha real de finalización
    // (las completadas antes de este cambio no la tienen y se ignoran
    // para no distorsionar el promedio).
    const tareasConFecha = tareas.filter(t => t.estado === 'COMPLETADA' && t.completadaEn);

    const completadasATiempo = tareasConFecha.filter(
      t => new Date(t.completadaEn) <= new Date(t.fechaFin)
    ).length;

    const tiempoPromedioResolucionHrs = tareasConFecha.length
      ? tareasConFecha.reduce((suma, t) => {
          const horas = (new Date(t.completadaEn) - new Date(t.creadoEn)) / (1000 * 60 * 60);
          return suma + horas;
        }, 0) / tareasConFecha.length
      : null;

    const reporte = await prisma.reporte.create({
      data: {
        mes:       mesN,
        anio:      anioN,
        totalTareas,
        completadas,
        pendientes,
        atrasadas,
        completadasATiempo,
        tiempoPromedioResolucionHrs,
        empleadoId: empleadoId ? parseInt(empleadoId) : null,
      },
      include: {
        empleado: { select: { id: true, nombre: true, numeroEmpleado: true } },
      },
    });

    res.status(201).json(reporte);
  } catch (error) {
    console.error('Error generarReporte:', error.message);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
};

// ── GET /api/reportes ────────────────────────────────────────────
const listarReportes = async (req, res) => {
  try {
    const reportes = await prisma.reporte.findMany({
      include: {
        empleado: { select: { id: true, nombre: true, numeroEmpleado: true } },
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    });
    res.json(reportes);
  } catch (error) {
    console.error('Error listarReportes:', error.message);
    res.status(500).json({ error: 'Error al listar reportes' });
  }
};

// ── GET /api/reportes/:id ────────────────────────────────────────
const obtenerReporte = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const reporte = await prisma.reporte.findUnique({
      where: { id },
      include: {
        empleado: { select: { id: true, nombre: true, numeroEmpleado: true } },
      },
    });

    if (!reporte) return res.status(404).json({ error: 'Reporte no encontrado' });
    res.json(reporte);
  } catch (error) {
    console.error('Error obtenerReporte:', error.message);
    res.status(500).json({ error: 'Error al obtener reporte' });
  }
};

// ── GET /api/reportes/:id/pdf ────────────────────────────────────
const exportarReportePDF = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const reporte = await prisma.reporte.findUnique({
      where: { id },
      include: {
        empleado: { select: { id: true, nombre: true, numeroEmpleado: true } },
      },
    });

    if (!reporte) return res.status(404).json({ error: 'Reporte no encontrado' });

    const logoSrc   = cargarLogoBase64();
    const ahora     = new Date();
    const fechaHora = ahora.toLocaleDateString('es-MX') + ' — ' +
                      ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const html = generarHTML(reporte, logoSrc, fechaHora);

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    const nombreMes = MESES[reporte.mes - 1];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename=reporte_${nombreMes}_${reporte.anio}.pdf`);
    res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    console.error('Error exportarReportePDF:', error.message);
    res.status(500).json({ error: 'Error al exportar reporte PDF' });
  }
};

// ── DELETE /api/reportes/:id ─────────────────────────────────────
const eliminarReporte = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    await prisma.reporte.delete({ where: { id } });
    res.json({ mensaje: 'Reporte eliminado correctamente' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Reporte no encontrado' });
    console.error('Error eliminarReporte:', error.message);
    res.status(500).json({ error: 'Error al eliminar reporte' });
  }
};

module.exports = { generarReporte, listarReportes, obtenerReporte, exportarReportePDF, eliminarReporte };