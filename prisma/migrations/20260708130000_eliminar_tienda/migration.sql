-- ══════════════════════════════════════════════════════════════
-- Elimina por completo el concepto de "Tienda". Todas las tareas y
-- usuarios pertenecen únicamente al área de TI, sin distinción por
-- tienda.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE "Usuario" DROP COLUMN IF EXISTS "tienda";
ALTER TABLE "Tarea"   DROP COLUMN IF EXISTS "tienda";
