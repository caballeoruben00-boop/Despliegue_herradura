-- ══════════════════════════════════════════════════════════════
-- Agrega el registro de fecha real de finalización de una tarea, y
-- dos métricas nuevas al reporte: cuántas tareas se completaron a
-- tiempo (antes o en su fecha límite) y el tiempo promedio de
-- resolución (en horas, desde que se creó hasta que se completó).
-- ══════════════════════════════════════════════════════════════

ALTER TABLE "Tarea"   ADD COLUMN "completadaEn" TIMESTAMP(3);
ALTER TABLE "Reporte" ADD COLUMN "completadasATiempo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reporte" ADD COLUMN "tiempoPromedioResolucionHrs" DOUBLE PRECISION;
