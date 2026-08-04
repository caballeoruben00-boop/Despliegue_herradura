/*
  Warnings:

  - Added the required column `hora` to the `Tarea` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tienda` to the `Tarea` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Tarea" ADD COLUMN     "hora" TEXT NOT NULL,
ADD COLUMN     "tienda" TEXT NOT NULL;
