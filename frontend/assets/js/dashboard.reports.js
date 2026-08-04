/**
 * La Herradura — Dashboard: Reportes
 * Filtros de reporte, KPIs, gráficas (dona/barras), historial y
 * generación/descarga de PDF.
 */
'use strict';

import { $, escHtml, getTaskStatus, store, toast, openConfirm, showLoading, hideLoading } from './dashboard.core.js';
import { generarReporte as generarReporteBackend, descargarReportePDF } from './api.reportes.js';

export const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function populateReportEmpleadoSelect() {
  const sel = $('rpt-filter-empleado');
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  store.users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.nombre; opt.textContent = u.nombre;
    opt.dataset.id = u.id;
    sel.appendChild(opt);
  });
}

export function getReportTasks() {
  const mes      = $('rpt-filter-mes')?.value      || '';
  const anio     = $('rpt-filter-anio')?.value     || '';
  const empleado = $('rpt-filter-empleado')?.value || '';
  return store.tasks.filter(t => {
    if (empleado && t.asignadoA?.nombre !== empleado) return false;
    if (mes || anio) {
      const due = new Date(t.fechaFin);
      if (mes  && (due.getMonth()+1) !== parseInt(mes, 10)) return false;
      if (anio && due.getFullYear()  !== parseInt(anio, 10)) return false;
    }
    return true;
  });
}

function renderRptKPIs(tasks) {
  const total   = tasks.length;
  const done    = tasks.filter(t => getTaskStatus(t) === 'done').length;
  const pending = tasks.filter(t => getTaskStatus(t) === 'pending').length;
  const overdue = tasks.filter(t => getTaskStatus(t) === 'overdue').length;
  const set = (id, v) => { const el=$(id); if(el) el.textContent = total===0 ? '—' : v; };
  set('rpt-kpi-total', total); set('rpt-kpi-done', done);
  set('rpt-kpi-pending', pending); set('rpt-kpi-overdue', overdue);
  set('rpt-donut-num', total); set('rpt-leg-done', done);
  set('rpt-leg-pending', pending); set('rpt-leg-overdue', overdue);

  // Solo cuenta tareas completadas que sí tienen fecha real de finalización
  // (las completadas antes de este cambio no la registran).
  const completadasConFecha = tasks.filter(t => getTaskStatus(t) === 'done' && t.completadaEn);
  const aTiempo = completadasConFecha.filter(t => new Date(t.completadaEn) <= new Date(t.fechaFin)).length;
  const ontimeEl = $('rpt-kpi-ontime');
  if (ontimeEl) {
    ontimeEl.textContent = completadasConFecha.length
      ? Math.round((aTiempo / completadasConFecha.length) * 100) + '%'
      : '—';
  }

  const avgtimeEl = $('rpt-kpi-avgtime');
  if (avgtimeEl) {
    if (!completadasConFecha.length) {
      avgtimeEl.textContent = '—';
    } else {
      const horasProm = completadasConFecha.reduce((suma, t) => {
        const horas = (new Date(t.completadaEn) - new Date(t.creadoEn)) / (1000 * 60 * 60);
        return suma + horas;
      }, 0) / completadasConFecha.length;
      avgtimeEl.textContent = horasProm < 24
        ? `${horasProm.toFixed(1)} h`
        : `${(horasProm / 24).toFixed(1)} días`;
    }
  }
}

function renderDonaChart(tasks) {
  const canvas = $('rpt-chart-dona'); if (!canvas) return;
  const done = tasks.filter(t => getTaskStatus(t) === 'done').length;
  const pending = tasks.filter(t => getTaskStatus(t) === 'pending').length;
  const overdue = tasks.filter(t => getTaskStatus(t) === 'overdue').length;
  if (store.rptChartDona) { store.rptChartDona.destroy(); store.rptChartDona = null; }
  const isEmpty = tasks.length === 0;
  store.rptChartDona = new Chart(canvas, {
    type: 'doughnut',
    data: { labels: ['Completadas','Pendientes','Atrasadas'],
      datasets: [{ data: isEmpty ? [1,0,0] : [done,pending,overdue],
        backgroundColor: isEmpty ? ['#EDE9E0'] : ['#27AE60','#E8B832','#C0392B'],
        borderWidth: 0, hoverOffset: isEmpty ? 0 : 6 }] },
    options: { cutout:'72%', responsive:true, maintainAspectRatio:true,
      plugins: { legend:{display:false}, tooltip:{enabled:!isEmpty} } },
  });
}

function renderRptProgressBars(tasks) {
  const container = $('rpt-progress-list'); if (!container) return;
  if (!tasks.length) {
    container.innerHTML = '<p class="rpt-progress-empty">Genera un reporte para ver los indicadores.</p>';
    return;
  }
  const total = tasks.length;
  const done = tasks.filter(t => getTaskStatus(t)==='done').length;
  const pending = tasks.filter(t => getTaskStatus(t)==='pending').length;
  const overdue = tasks.filter(t => getTaskStatus(t)==='overdue').length;
  const pct = n => total===0 ? 0 : Math.round(n/total*100);
  const bars = [
    { label:'Tasa de completitud', value:pct(done),    color:'var(--color-success)', icon:'✅' },
    { label:'Tareas pendientes',   value:pct(pending), color:'var(--color-warning)', icon:'⏳' },
    { label:'Tareas atrasadas',    value:pct(overdue), color:'var(--color-error)',   icon:'🚨' },
  ];
  container.innerHTML = bars.map(b => `
    <div class="rpt-progress-item">
      <div class="rpt-progress-item__header">
        <span class="rpt-progress-item__label">${b.icon} ${b.label}</span>
        <span class="rpt-progress-item__val">${b.value}%</span>
      </div>
      <div class="rpt-progress-track">
        <div class="rpt-progress-fill" style="width:0%;background:${b.color}" data-target="${b.value}"></div>
      </div>
    </div>`).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    container.querySelectorAll('.rpt-progress-fill').forEach(f => {
      f.style.transition = 'width 700ms cubic-bezier(.4,0,.2,1)';
      f.style.width = f.dataset.target + '%';
    });
  }));
}

export function generateReport() {
  const tasks = getReportTasks();
  renderRptKPIs(tasks);
  renderDonaChart(tasks);
  renderRptProgressBars(tasks);
  const mes = $('rpt-filter-mes')?.value || '';
  const anio = $('rpt-filter-anio')?.value || '';
  const periodo = mes && anio ? `${MONTH_NAMES[parseInt(mes,10)-1]} ${anio}` : anio || mes ? (anio || MONTH_NAMES[parseInt(mes,10)-1]) : 'Todo el período';
  store.reportHistory.unshift({
    id: 'RPT' + Date.now().toString(36).toUpperCase(),
    backendId: null,
    periodo,
    empleado: $('rpt-filter-empleado')?.value || 'Todos',
    generado: new Date().toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'}),
    tasks,
  });
  renderReportHistory();
  toast(`📊 Reporte generado: ${tasks.length} tarea${tasks.length!==1?'s':''}`, 'success');
}

/**
 * Crea el reporte en el backend (POST /api/reportes) y descarga el PDF
 * generado con Puppeteer (GET /api/reportes/:id/pdf). El backend exige
 * mes y año, así que se validan antes de llamar.
 */
async function crearYDescargarPDF() {
  const mes  = $('rpt-filter-mes')?.value  || '';
  const anio = $('rpt-filter-anio')?.value || '';

  if (!mes || !anio) {
    toast('⚠️ Selecciona mes y año para crear el PDF', 'error');
    return;
  }

  const empleadoSel = $('rpt-filter-empleado');
  const empleadoOpt = empleadoSel?.selectedOptions?.[0] || null;

  const empleadoId = empleadoOpt?.dataset?.id ? parseInt(empleadoOpt.dataset.id, 10) : undefined;

  if (pdfBusy) return; // evita doble-click mientras ya se está generando un PDF
  pdfBusy = true;
  setPdfButtonsDisabled(true);
  const btn = $('rpt-pdf-btn');
  btn?.classList.add('is-loading');
  showLoading('Creando y generando PDF…');

  try {
    const reporte = await generarReporteBackend({
      mes, anio,
      empleadoId,
    });

    store.reportHistory.unshift({
      id: 'RPT' + Date.now().toString(36).toUpperCase(),
      backendId: reporte.id,
      periodo: `${MONTH_NAMES[parseInt(mes,10)-1]} ${anio}`,
      empleado: empleadoSel?.value || 'Todos',
      generado: new Date().toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'}),
      tasks: getReportTasks(),
    });
    renderReportHistory();

    await descargarReportePDF(reporte.id);
    toast('📄 PDF generado correctamente', 'success');
  } catch (err) {
    toast(`❌ ${err.message || 'No se pudo crear el PDF'}`, 'error');
  } finally {
    btn?.classList.remove('is-loading');
    setPdfButtonsDisabled(false);
    hideLoading();
    pdfBusy = false;
  }
}

/* Evita que el usuario dispare dos generaciones/descargas de PDF a la vez,
   ya sea con doble-click en el mismo botón o combinando el botón principal
   con los botones de descarga por fila del historial. */
let pdfBusy = false;
function setPdfButtonsDisabled(disabled) {
  const mainBtn = $('rpt-pdf-btn');
  if (disabled) mainBtn?.setAttribute('disabled', 'true');
  else mainBtn?.removeAttribute('disabled');
  document.querySelectorAll('.rpt-pdf-row-btn').forEach(b => {
    if (disabled) b.setAttribute('disabled', 'true');
    else b.removeAttribute('disabled');
  });
}

function renderReportHistory() {
  const tbody = $('rpt-history-body'); if (!tbody) return;
  const countEl = $('rpt-history-count');
  if (countEl) countEl.textContent = `${store.reportHistory.length} reporte${store.reportHistory.length!==1?'s':''}`;
  const emptyRow = $('rpt-history-empty');
  if (!store.reportHistory.length) { if (emptyRow) emptyRow.removeAttribute('hidden'); tbody.querySelectorAll('.rpt-history-row').forEach(r=>r.remove()); return; }
  if (emptyRow) emptyRow.hidden = true;
  tbody.querySelectorAll('.rpt-history-row').forEach(r=>r.remove());
  store.reportHistory.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'rpt-history-row';
    const pdfBtn = item.backendId
      ? `<button class="task-btn task-btn--edit rpt-pdf-row-btn" data-id="${item.backendId}" title="Descargar PDF">📄</button>`
      : '';
    tr.innerHTML = `<td><span class="rpt-period-badge">${escHtml(item.periodo)}</span></td>
      <td>${escHtml(item.empleado)}</td><td>${escHtml(item.generado)}</td>
      <td><span class="rpt-status-badge rpt-status-badge--ok">✓ Generado</span></td>
      <td><div class="rpt-action-btns">
        ${pdfBtn}
        <button class="task-btn task-btn--edit rpt-del-btn" data-idx="${idx}">🗑️</button>
      </div></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.rpt-pdf-row-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (pdfBusy) return; // evita doble-click
      pdfBusy = true;
      setPdfButtonsDisabled(true);
      btn.classList.add('is-loading');
      showLoading('Descargando PDF…');
      try {
        await descargarReportePDF(parseInt(btn.dataset.id, 10));
      } catch (err) {
        toast(`❌ ${err.message || 'No se pudo descargar el PDF'}`, 'error');
      } finally {
        btn.classList.remove('is-loading');
        setPdfButtonsDisabled(false);
        hideLoading();
        pdfBusy = false;
      }
    });
  });
  tbody.querySelectorAll('.rpt-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      openConfirm('¿Eliminar este reporte?', () => {
        store.reportHistory.splice(idx,1);
        renderReportHistory();
        toast('🗑️ Reporte eliminado', 'success');
      });
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   EVENTOS — filtros y acciones de la sección de reportes
══════════════════════════════════════════════════════════════ */
export function attachReportEvents() {
  $('rpt-generate-btn')?.addEventListener('click', generateReport);
  $('rpt-preview-btn')?.addEventListener('click',  generateReport);
  $('rpt-pdf-btn')?.addEventListener('click', crearYDescargarPDF);
  $('rpt-clear-btn')?.addEventListener('click', () => {
    ['rpt-filter-mes','rpt-filter-empleado'].forEach(id => { const el=$(id); if(el) el.value=''; });
    const anioSel = $('rpt-filter-anio');
    if (anioSel) { const y=new Date().getFullYear().toString(); for(let i=0;i<anioSel.options.length;i++) if(anioSel.options[i].value===y){anioSel.selectedIndex=i;break;} }
    toast('Filtros del reporte limpiados','success');
  });
}
