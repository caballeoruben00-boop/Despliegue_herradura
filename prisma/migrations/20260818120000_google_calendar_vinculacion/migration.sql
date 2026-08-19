-- Vinculación de cada usuario con su propia cuenta de Google Calendar,
-- y referencia al evento creado por cada tarea.

ALTER TABLE "Usuario"
  ADD COLUMN "googleAccessToken"   TEXT,
  ADD COLUMN "googleRefreshToken"  TEXT,
  ADD COLUMN "googleTokenExpiry"   TIMESTAMP(3),
  ADD COLUMN "googleCalendarEmail" TEXT;

ALTER TABLE "Tarea"
  ADD COLUMN "googleEventId" TEXT;
