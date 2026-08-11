-- Reporte.mes: ahora opcional. Un reporte con mes = NULL representa
-- un reporte anual (todo el año indicado en "anio").
ALTER TABLE "Reporte" ALTER COLUMN "mes" DROP NOT NULL;
