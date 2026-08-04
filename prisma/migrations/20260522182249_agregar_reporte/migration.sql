-- CreateTable
CREATE TABLE "Reporte" (
    "id" SERIAL NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "totalTareas" INTEGER NOT NULL DEFAULT 0,
    "completadas" INTEGER NOT NULL DEFAULT 0,
    "pendientes" INTEGER NOT NULL DEFAULT 0,
    "atrasadas" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "areaId" INTEGER,
    "empleadoId" INTEGER,

    CONSTRAINT "Reporte_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
