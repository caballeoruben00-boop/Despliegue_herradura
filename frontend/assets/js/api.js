/**
 * ============================================================
 *  La Herradura — API Layer
 *  api.js  — Punto de entrada único (barrel file)
 * ============================================================
 *
 * En lugar de importar desde 5 archivos distintos, puedes
 * importar todo desde api.js:
 *
 *   import { login, listarTareas, listarAreas } from './api.js';
 *
 * O, si prefieres ser explícito por módulo:
 *
 *   import { login } from './api.auth.js';
 *   import { listarTareas } from './api.tareas.js';
 */

export * from './api.config.js';
export * from './api.auth.js';
export * from './api.tareas.js';
export * from './api.usuarios.js';
export * from './api.reportes.js';
export * from './api.notificaciones.js';
