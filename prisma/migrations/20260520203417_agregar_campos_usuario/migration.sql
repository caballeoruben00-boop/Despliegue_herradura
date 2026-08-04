/*
  Warnings:

  - A unique constraint covering the columns `[numeroEmpleado]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `numeroEmpleado` to the `Usuario` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "cargo" TEXT,
ADD COLUMN     "numeroEmpleado" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_numeroEmpleado_key" ON "Usuario"("numeroEmpleado");
