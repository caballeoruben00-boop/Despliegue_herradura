/**
 * Script temporal de verificación visual (móvil) — no forma parte del proyecto.
 * Sirve el frontend con datos simulados y captura pantallas a 390x844.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'frontend');
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '_shots');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

const users = [
  { id: 1, nombre: 'Ana Rodríguez Villaseñor', numeroEmpleado: 'E-00120', email: 'ana@herradura.mx', cargo: 'Jefa de Almacén General', rol: 'EMPLEADO', activo: true },
  { id: 2, nombre: 'Roberto Cabalán', numeroEmpleado: 'E-00001', email: 'admin@herradura.mx', cargo: 'Administrador del Sistema', rol: 'ADMIN', activo: true },
  { id: 3, nombre: 'José Luis Hernández Pérez', numeroEmpleado: 'E-00214', email: 'jl@herradura.mx', cargo: 'Supervisor de Piso Nocturno', rol: 'EMPLEADO', activo: false },
  { id: 4, nombre: 'María Fernanda Solís', numeroEmpleado: 'E-00311', email: 'mf@herradura.mx', cargo: 'Cajera', rol: 'EMPLEADO', activo: true },
];
const tasks = [
  { id: 11, nombre: 'Revisión de caja chica y conciliación de tickets del turno vespertino', descripcion: 'Verificar que los cortes coincidan con el sistema.', estado: 'PENDIENTE', prioridad: 'ALTA', fechaFin: '2026-08-14', asignadoA: users[0], _count: { evidencias: 2 } },
  { id: 12, nombre: 'Inventario de bodega', descripcion: null, estado: 'COMPLETADA', prioridad: 'MEDIA', fechaFin: '2026-08-02', asignadoA: users[3], _count: { evidencias: 0 } },
  { id: 13, nombre: 'Mantenimiento de refrigeradores', estado: 'ATRASADA', prioridad: 'BAJA', fechaFin: '2026-07-28', asignadoA: users[2], _count: { evidencias: 5 } },
];

const api = (url) => {
  if (url.startsWith('/api/usuarios')) return users;
  if (url.startsWith('/api/tareas')) return tasks;
  if (url.startsWith('/api/notificaciones/no-leidas')) return { noLeidas: 2 };
  if (url.startsWith('/api/notificaciones')) return {
    noLeidas: 2,
    notificaciones: [
      { id: 9, tipo: 'tarea_asignada', titulo: 'Nueva tarea asignada', mensaje: 'Se te asignó "Revisión de caja chica y conciliación de tickets".', leida: false, creadoEn: '2026-08-10T14:20:00Z' },
      { id: 8, tipo: 'tarea_vencida', titulo: 'Tarea vencida', mensaje: 'Mantenimiento de refrigeradores venció el 27 jul 2026.', leida: false, creadoEn: '2026-08-09T09:00:00Z' },
      { id: 7, tipo: 'tarea_completada', titulo: 'Tarea completada', mensaje: 'María Fernanda Solís completó "Inventario de bodega".', leida: true, creadoEn: '2026-08-08T18:30:00Z' },
    ],
  };
  return {};
};

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url.startsWith('/api/notificaciones/stream')) { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); return; }
  if (url.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(api(url)));
  }
  const file = path.join(ROOT, url === '/' ? 'dashboard.html' : url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

await new Promise(r => server.listen(4599, r));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluateOnNewDocument(() => {
  sessionStorage.setItem('lh_token', 'fake');
  sessionStorage.setItem('lh_user', JSON.stringify({ id: 2, nombre: 'Roberto Cabalán', username: 'admin', email: 'admin@herradura.mx', rol: 'ADMIN' }));
});
page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto('http://localhost:4599/dashboard.html', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1200));

const shot = async (name, full = true) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log('shot:', name);
};

await shot('01-overview');
await page.evaluate(() => window.navigateTo('employees'));
await new Promise(r => setTimeout(r, 700));
await shot('02-usuarios');
await page.evaluate(() => window.navigateTo('tasks'));
await new Promise(r => setTimeout(r, 700));
await shot('03-tareas');
await page.evaluate(() => window.openEditUser(1));
await new Promise(r => setTimeout(r, 600));
await shot('04-modal-usuario', false);
await page.evaluate(() => document.getElementById('modal-user-cancel').click());
await page.evaluate(() => window.navigateTo('notifications'));
await new Promise(r => setTimeout(r, 600));
await shot('05-notificaciones');
await page.evaluate(() => document.getElementById('btn-hamburger').click());
await new Promise(r => setTimeout(r, 600));
await shot('06-menu', false);
await page.evaluate(() => document.getElementById('sidebar-overlay').click());
await page.evaluate(() => document.getElementById('btn-notif-bell').click());
await new Promise(r => setTimeout(r, 500));
await shot('07-campana', false);

/* 360px — el ancho más estrecho habitual en Android */
await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluate(() => { document.getElementById('btn-notif-bell').click(); window.navigateTo('employees'); });
await new Promise(r => setTimeout(r, 700));
await shot('08-usuarios-360');
await page.evaluate(() => window.confirmDeleteUser(1));
await new Promise(r => setTimeout(r, 500));
await shot('09-confirm-360', false);
await page.evaluate(() => document.getElementById('modal-confirm-cancel').click());
await page.evaluate(() => window.navigateTo('reports'));
await new Promise(r => setTimeout(r, 700));
await shot('10-reportes-360');
await page.evaluate(() => window.navigateTo('tasks'));
await page.evaluate(() => document.getElementById('btn-new-task').click());
await new Promise(r => setTimeout(r, 600));
await shot('11-modal-tarea-360', false);
await page.evaluate(() => { const m = document.getElementById('modal-task'); m.scrollTop = m.scrollHeight; });
await new Promise(r => setTimeout(r, 400));
await shot('12-modal-tarea-fondo-360', false);

/* Escritorio: comprobar que no se rompió la vista amplia */
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await page.evaluate(() => { document.getElementById('modal-task-cancel').click(); window.navigateTo('employees'); });
await new Promise(r => setTimeout(r, 700));
await shot('13-usuarios-desktop', false);

await browser.close();
server.close();
console.log('done');
