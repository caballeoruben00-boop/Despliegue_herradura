-- AlterEnum
-- Postgres no permite agregar un valor a un enum dentro de una transacción
-- implícita junto con otros cambios, por eso va en su propia migración.
ALTER TYPE "Rol" ADD VALUE 'GERENTE';
