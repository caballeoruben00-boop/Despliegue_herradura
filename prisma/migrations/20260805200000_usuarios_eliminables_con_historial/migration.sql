-- Tarea.asignadoAId: ahora opcional, y al eliminar el usuario queda en NULL
ALTER TABLE "Tarea" ALTER COLUMN "asignadoAId" DROP NOT NULL;
ALTER TABLE "Tarea" DROP CONSTRAINT "Tarea_asignadoAId_fkey";
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_asignadoAId_fkey"
  FOREIGN KEY ("asignadoAId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tarea.creadoPorId: ídem
ALTER TABLE "Tarea" ALTER COLUMN "creadoPorId" DROP NOT NULL;
ALTER TABLE "Tarea" DROP CONSTRAINT "Tarea_creadoPorId_fkey";
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notificacion.usuarioId: se borran en cascada junto con el usuario
ALTER TABLE "Notificacion" DROP CONSTRAINT "Notificacion_usuarioId_fkey";
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Evidencia.subidoPorId: ahora opcional, queda en NULL si se borra el usuario
ALTER TABLE "Evidencia" ALTER COLUMN "subidoPorId" DROP NOT NULL;
ALTER TABLE "Evidencia" DROP CONSTRAINT "Evidencia_subidoPorId_fkey";
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_subidoPorId_fkey"
  FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
