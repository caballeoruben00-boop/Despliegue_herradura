const prisma    = require('../prismaClient');
const puppeteer = require('puppeteer');
const path      = require('path');
const fs        = require('fs');

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Zona horaria de la empresa. creadoEn/completadaEn se guardan en la BD
// como instantes reales (UTC internamente), así que aquí es donde se
// convierten a la hora local para que el PDF siempre muestre la hora
// correcta sin importar en qué zona horaria corra el servidor.
const ZONA_HORARIA = 'America/Mexico_City';

const ESTADO_LABEL = {
  COMPLETADA: 'Completada',
  PENDIENTE:  'Pendiente',
  ATRASADA:   'Atrasada',
};

const PRIORIDAD_LABEL = {
  ALTA:  'Alta',
  MEDIA: 'Media',
  BAJA:  'Baja',
};

// ─── Utilidad: rango [gte, lt) de un mes o de un año completo ───
// Si mes es null/undefined, cubre el año completo (reporte anual).
function rangoFechas(anioN, mesN) {
  if (mesN) {
    return {
      gte: new Date(anioN, mesN - 1, 1),
      lt:  new Date(anioN, mesN,     1),
    };
  }
  return {
    gte: new Date(anioN, 0, 1),
    lt:  new Date(anioN + 1, 0, 1),
  };
}

// ─── Utilidad: carga el logo como base64 ────────────────────────
// Busca el logo en varias rutas posibles para que no rompa si cambia
// la ubicación del archivo.
function cargarLogoBase64() {
  const rutas = [
    path.join(__dirname, '../../frontend/assets/img/favicon-32x32.png'),
    path.join(__dirname, '../assets/images.jpg'),
    path.join(__dirname, '../assets/logo.jpg'),
    path.join(__dirname, '../assets/logo.png'),
    path.join(__dirname, '../../assets/img/logo.png'),
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

// ─── Utilidad: formatea una fecha corta (dd/mm/aaaa) o '—' ──────
function fechaCorta(fecha) {
  // timeZone: 'UTC' evita que la fecha se recorra un día hacia atrás:
  // fechaInicio/fechaFin se guardan como fecha "pura" (medianoche UTC).
  return fecha ? new Date(fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '—';
}

// ─── Utilidad: formatea fecha + hora (dd/mm/aaaa, hh:mm a. m.) o '—' ─
// A diferencia de fechaCorta, esta SÍ convierte a la zona horaria local
// (ZONA_HORARIA) porque creadoEn/completadaEn son marcas de tiempo reales
// (el momento exacto en que se creó o completó la tarea), no fechas puras.
function fechaHoraCorta(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha);
  const fechaTxt = d.toLocaleDateString('es-MX', { timeZone: ZONA_HORARIA });
  const horaTxt  = d.toLocaleTimeString('es-MX', {
    timeZone: ZONA_HORARIA, hour: '2-digit', minute: '2-digit',
  });
  return `${fechaTxt}, ${horaTxt}`;
}

// ─── Utilidad: genera las filas de la tabla de resumen de tareas ─
function generarFilasTareas(tareas) {
  if (!tareas || tareas.length === 0) {
    return `<tr><td colspan="7" class="tabla-vacia">No hay tareas registradas en este período.</td></tr>`;
  }

  return tareas.map(t => {
    const estadoClase = t.estado === 'COMPLETADA' ? 'e-completada'
                       : t.estado === 'ATRASADA'   ? 'e-atrasada'
                       : 'e-pendiente';
    return `
      <tr>
        <td class="col-nombre">${t.nombre}</td>
        <td>${t.asignadoA?.nombre ?? '—'}</td>
        <td><span class="badge-estado ${estadoClase}">${ESTADO_LABEL[t.estado] ?? t.estado}</span></td>
        <td>${PRIORIDAD_LABEL[t.prioridad] ?? t.prioridad}</td>
        <td>${fechaCorta(t.fechaFin)}</td>
        <td>${fechaHoraCorta(t.creadoEn)}</td>
        <td>${fechaHoraCorta(t.completadaEn)}</td>
      </tr>`;
  }).join('');
}

// ─── Utilidad: desglose mensual para reportes anuales ────────────
function generarDesgloseMensual(tareas, anioN) {
  const meses = Array.from({ length: 12 }, (_, i) => ({
    mes: i,
    total: 0,
    completadas: 0,
    pendientes: 0,
    atrasadas: 0,
  }));

  tareas.forEach(t => {
    const m = new Date(t.creadoEn).getMonth();
    meses[m].total++;
    if (t.estado === 'COMPLETADA') meses[m].completadas++;
    else if (t.estado === 'ATRASADA') meses[m].atrasadas++;
    else meses[m].pendientes++;
  });

  const maxTotal = Math.max(...meses.map(m => m.total), 1);

  const filas = meses.map(m => {
    const alturaPct = Math.round((m.total / maxTotal) * 100);
    const cPct = m.total ? Math.round((m.completadas / m.total) * 100) : 0;
    const pPct = m.total ? Math.round((m.pendientes  / m.total) * 100) : 0;
    const aPct = m.total ? Math.round((m.atrasadas   / m.total) * 100) : 0;
    return `
      <div class="mes-col">
        <div class="mes-barra" style="height:${Math.max(alturaPct, 4)}%">
          <div class="mes-seg c" style="height:${cPct}%"></div>
          <div class="mes-seg p" style="height:${pPct}%"></div>
          <div class="mes-seg a" style="height:${aPct}%"></div>
        </div>
        <span class="mes-num">${m.total}</span>
        <span class="mes-lbl">${MESES[m.mes].slice(0,3)}</span>
      </div>`;
  }).join('');

  return `
    <div class="tabla-section">
      <h2 class="section-title">Distribución mensual — ${anioN}</h2>
      <div class="mes-chart">${filas}</div>
      <div class="pie-legend mes-legend">
        <div class="leg-item"><div class="leg-dot" style="background:#22c55e"></div>Completadas</div>
        <div class="leg-item"><div class="leg-dot" style="background:#f59e0b"></div>Pendientes</div>
        <div class="leg-item"><div class="leg-dot" style="background:#ef4444"></div>Atrasadas</div>
      </div>
    </div>`;
}

// ─── Utilidad: resumen ejecutivo en texto ─────────────────────────
function generarResumenEjecutivo(reporte, periodoTexto) {
  const total = reporte.totalTareas;
  if (total === 0) {
    return `No se registraron tareas durante ${periodoTexto}.`;
  }

  const pctCompletadas = Math.round((reporte.completadas / total) * 100);
  const pctAtrasadas   = Math.round((reporte.atrasadas   / total) * 100);

  const tasaATiempoPct = reporte.completadas > 0
    ? Math.round((reporte.completadasATiempo / reporte.completadas) * 100)
    : null;

  let valoracion;
  if (pctCompletadas >= 80) valoracion = 'un desempeño sobresaliente';
  else if (pctCompletadas >= 60) valoracion = 'un desempeño aceptable';
  else valoracion = 'un desempeño que requiere atención';

  return `Durante ${periodoTexto} se registraron ${total} tarea${total !== 1 ? 's' : ''} en total, ` +
    `de las cuales ${reporte.completadas} (${pctCompletadas}%) fueron completadas` +
    (tasaATiempoPct != null ? `, con un ${tasaATiempoPct}% de cumplimiento dentro del plazo establecido` : '') +
    `. Se registraron ${reporte.atrasadas} tarea${reporte.atrasadas !== 1 ? 's' : ''} atrasada${reporte.atrasadas !== 1 ? 's' : ''} ` +
    `(${pctAtrasadas}% del total), lo que refleja ${valoracion} en el período evaluado.`;
}

// ─── Utilidad: genera el HTML del reporte ───────────────────────
function generarHTML(reporte, logoSrc, fechaHora, tareas) {
  const esAnual      = reporte.mes == null;
  const nombreMes    = esAnual ? null : MESES[reporte.mes - 1];
  const periodoTexto = esAnual ? `Todo el año ${reporte.anio}` : `${nombreMes} ${reporte.anio}`;
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

  // Resumen ejecutivo en texto y desglose mensual (solo reportes anuales)
  const resumenTexto        = generarResumenEjecutivo(reporte, periodoTexto);
  const desgloseMensualHTML = esAnual ? generarDesgloseMensual(tareas, reporte.anio) : '';

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

  .section-title {
    font-size: 13px; font-weight: bold; color: #2d7a2d;
    margin: 0 0 10px; padding-bottom: 6px; border-bottom: 2px solid #c8860a;
  }

  .resumen-ejecutivo {
    background:#f9f9f9; border-left:4px solid #2d7a2d;
    padding:14px 16px; border-radius:4px; margin-bottom:22px;
    font-size:12px; line-height:1.6;
  }

  .mes-chart {
    display:flex; align-items:flex-end; gap:6px;
    height:140px; padding:10px 4px; margin-bottom:10px;
  }
  .mes-col { flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; }
  .mes-barra {
    width:100%; max-width:26px; display:flex; flex-direction:column-reverse;
    border-radius:3px 3px 0 0; overflow:hidden; background:#e5e7eb;
  }
  .mes-seg.c { background:#22c55e; }
  .mes-seg.p { background:#f59e0b; }
  .mes-seg.a { background:#ef4444; }
  .mes-num { font-size:9px; color:#666; margin-top:4px; }
  .mes-lbl { font-size:9px; color:#999; }
  .mes-legend { flex-direction:row; justify-content:center; gap:16px; margin-bottom:22px; }

  .tabla-tareas { width: 100%; border-collapse: collapse; font-size: 9.5px; table-layout: fixed; }
  .tabla-tareas thead { display: table-header-group; }
  .tabla-tareas th {
    background: #2d7a2d; color: white; text-align: left;
    padding: 7px 6px; font-size: 9px; text-transform: uppercase;
  }
  .tabla-tareas td { padding: 6px 6px; border-bottom: 1px solid #eee; vertical-align: top;
    word-wrap: break-word; overflow-wrap: break-word; }
  .tabla-tareas tbody tr { page-break-inside: avoid; }
  .tabla-tareas tbody tr:nth-child(even) { background: #fafafa; }
  .tabla-tareas .col-nombre { font-weight: 600; }
  .tabla-tareas .tabla-vacia { text-align: center; color: #999; padding: 16px; }
  .tabla-tareas th:nth-child(1), .tabla-tareas td:nth-child(1) { width: 21%; }
  .tabla-tareas th:nth-child(2), .tabla-tareas td:nth-child(2) { width: 15%; }
  .tabla-tareas th:nth-child(3), .tabla-tareas td:nth-child(3) { width: 11%; }
  .tabla-tareas th:nth-child(4), .tabla-tareas td:nth-child(4) { width: 9%; }
  .tabla-tareas th:nth-child(5), .tabla-tareas td:nth-child(5) { width: 14%; }
  .tabla-tareas th:nth-child(6), .tabla-tareas td:nth-child(6) { width: 15%; }
  .tabla-tareas th:nth-child(7), .tabla-tareas td:nth-child(7) { width: 15%; }

  .badge-estado {
    display: inline-block; padding: 2px 8px; border-radius: 10px;
    font-size: 9.5px; font-weight: bold; color: white; white-space: nowrap;
  }
  .badge-estado.e-completada { background: #22c55e; }
  .badge-estado.e-pendiente  { background: #f59e0b; }
  .badge-estado.e-atrasada   { background: #ef4444; }

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
    <h1>Reporte ${esAnual ? 'Anual' : 'Mensual'} de Actividades</h1>
    <p>Comercializadora de Granos La Herradura</p>
  </div>
</div>

<div class="content">

  <div class="info-grid">
    <div class="info-box">
      <label>Período</label>
      <p>${periodoTexto}</p>
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

  <div class="resumen-ejecutivo">
    <h2 class="section-title">Resumen ejecutivo</h2>
    <p>${resumenTexto}</p>
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

  ${desgloseMensualHTML}

  <div class="tabla-section">
    <h2 class="section-title">Resumen por tarea (${total})</h2>
    <table class="tabla-tareas">
      <thead>
        <tr>
          <th>Tarea</th>
          <th>Asignado a</th>
          <th>Estado</th>
          <th>Prioridad</th>
          <th>Fecha límite</th>
          <th>Creada el</th>
          <th>Completada el</th>
        </tr>
      </thead>
      <tbody>
        ${generarFilasTareas(tareas)}
      </tbody>
    </table>
  </div>

</div>

<div class="footer">
  <span>Comercializadora de Granos La Herradura</span>
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

  // "mes" ahora es opcional: si no se envía, se genera un reporte
  // anual que cubre los 12 meses del año indicado.
  if (!anio) {
    return res.status(400).json({ error: 'El campo anio es obligatorio' });
  }

  const mesN  = (mes === undefined || mes === null || mes === '') ? null : parseInt(mes);
  const anioN = parseInt(anio);

  if (mesN != null && (mesN < 1 || mesN > 12)) {
    return res.status(400).json({ error: 'El mes debe ser entre 1 y 12' });
  }

  try {
    const where = {
      creadoEn: rangoFechas(anioN, mesN),
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

    // Recupera el detalle de las tareas del período (mismo filtro con el
    // que se calcularon los totales) para el resumen por tarea del PDF.
    const whereTareas = { creadoEn: rangoFechas(reporte.anio, reporte.mes) };
    if (reporte.empleadoId) whereTareas.asignadoAId = reporte.empleadoId;

    const tareas = await prisma.tarea.findMany({
      where: whereTareas,
      include: { asignadoA: { select: { nombre: true } } },
      orderBy: [{ fechaFin: 'asc' }],
    });

    const logoSrc   = cargarLogoBase64();
    const ahora     = new Date();
    const fechaHora = ahora.toLocaleDateString('es-MX', { timeZone: ZONA_HORARIA }) + ' — ' +
                      ahora.toLocaleTimeString('es-MX', { timeZone: ZONA_HORARIA, hour: '2-digit', minute: '2-digit' });

    const html = generarHTML(reporte, logoSrc, fechaHora, tareas);

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    const sufijoPeriodo = reporte.mes ? `${MESES[reporte.mes - 1]}_${reporte.anio}` : `Anual_${reporte.anio}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename=reporte_${sufijoPeriodo}.pdf`);
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