-- ══════════════════════════════════════════════════════════════
-- Elimina por completo el concepto de "Área" y el rol GERENTE.
-- A partir de ahora solo existen los roles ADMIN y EMPLEADO, y no
-- hay separación por áreas: todas las tareas y reportes son
-- compartidos entre administradores.
-- ══════════════════════════════════════════════════════════════

-- Quitar las llaves foráneas que apuntan a "Area"
ALTER TABLE "Tarea"   DROP CONSTRAINT IF EXISTS "Tarea_areaId_fkey";
ALTER TABLE "Usuario" DROP CONSTRAINT IF EXISTS "Usuario_areaId_fkey";
ALTER TABLE "Reporte" DROP CONSTRAINT IF EXISTS "Reporte_areaId_fkey";

-- Quitar las columnas areaId
ALTER TABLE "Tarea"   DROP COLUMN IF EXISTS "areaId";
ALTER TABLE "Usuario" DROP COLUMN IF EXISTS "areaId";
ALTER TABLE "Reporte" DROP COLUMN IF EXISTS "areaId";

-- Eliminar la tabla Area
DROP TABLE IF EXISTS "Area";

-- Reasignar cualquier usuario GERENTE existente a EMPLEADO antes de
-- quitar el valor del enum (Postgres no permite borrar un valor de
-- un enum en uso directamente).
UPDATE "Usuario" SET "rol" = 'EMPLEADO' WHERE "rol" = 'GERENTE';

-- Recrear el enum Rol sin GERENTE
CREATE TYPE "Rol_new" AS ENUM ('ADMIN', 'EMPLEADO');
ALTER TABLE "Usuario" ALTER COLUMN "rol" DROP DEFAULT;
ALTER TABLE "Usuario" ALTER COLUMN "rol" TYPE "Rol_new" USING ("rol"::text::"Rol_new");
DROP TYPE "Rol";
ALTER TYPE "Rol_new" RENAME TO "Rol";
ALTER TABLE "Usuario" ALTER COLUMN "rol" SET DEFAULT 'EMPLEADO';
