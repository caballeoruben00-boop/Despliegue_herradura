-- CreateTable
CREATE TABLE "SesionActiva" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "jti" TEXT NOT NULL,
    "dispositivo" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaActividad" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionActiva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SesionActiva_jti_key" ON "SesionActiva"("jti");

-- AddForeignKey
ALTER TABLE "SesionActiva" ADD CONSTRAINT "SesionActiva_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
