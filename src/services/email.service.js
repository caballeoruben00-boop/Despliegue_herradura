// ─── Correo de bienvenida vía API de Brevo (antes Sendinblue) ──────
// Brevo (https://www.brevo.com) ofrece un plan gratuito de 300
// correos/día y, a diferencia de otras APIs (Resend, SendGrid…), solo
// exige verificar un CORREO remitente (no un dominio completo) para
// poder enviar a cualquier destinatario. Ideal para este caso, donde
// se manda un correo a cada usuario nuevo que se crea.
//
// No se usa ninguna librería SDK: basta con `fetch` (incluido desde
// Node 18+) contra el endpoint REST de Brevo, así no se agrega una
// dependencia extra al proyecto.
//
// Variables de entorno necesarias (.env):
//   BREVO_API_KEY      → API Key generada en Brevo (Settings → API Keys)
//   BREVO_SENDER_EMAIL → correo remitente, ya verificado en Brevo
//   BREVO_SENDER_NAME  → (opcional) nombre que verá el destinatario
//   LOGO_URL           → (opcional) URL pública https del logo
//
// Si BREVO_API_KEY o BREVO_SENDER_EMAIL no están configurados, el
// envío se omite silenciosamente (con un aviso en consola) para no
// interrumpir la creación de usuarios.

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

// ─── Logo del correo ─────────────────────────────────────────────
// IMPORTANTE: Brevo NO soporta imágenes incrustadas por CID/attachment
// (confirmado por Brevo: cualquier "inlineImages"/cid se manda como
// adjunto normal, nunca como imagen embebida). Y aunque se use un
// data-URI en base64 directo en el <img src>, Gmail lo bloquea por
// seguridad y no lo muestra. La única forma confiable de que el logo
// se vea en todos los clientes (incluido Gmail) es referenciarlo con
// una URL pública real (https://...), por eso se usa LOGO_URL del
// .env en vez de leer un archivo local y adjuntarlo.
function obtenerLogoUrl() {
  const url = process.env.LOGO_URL;
  return url && url.trim() ? url.trim() : null;
}

// ─── Plantilla HTML del correo de bienvenida ────────────────────────
function plantillaBienvenida({ nombre, username, numeroEmpleado, email, password, logoUrl }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#333;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.06);">

          <tr>
            <td style="background:linear-gradient(135deg,#c8860a,#2d7a2d);padding:28px 30px;text-align:center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="Comercializadora de Granos La Herradura" width="64" height="64" style="border-radius:8px;background:#fff;padding:4px;display:block;margin:0 auto 10px;" />` : ''}
              <h1 style="color:#fff;font-size:20px;margin:0;">¡Bienvenido(a) a Comercializadora de Granos La Herradura!</h1>
              <p style="color:#fff;opacity:.9;font-size:12px;margin:6px 0 0;">Comercializadora de Granos La Herradura</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 30px;">
              <p style="font-size:15px;margin:0 0 16px;">Hola <strong>${nombre}</strong>,</p>
              <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#555;">
                Se ha creado tu cuenta en el <strong>Sistema de Administración de Actividades</strong>
                de Comercializadora de Granos La Herradura. Estos son tus datos de acceso:
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f7;border-left:4px solid #c8860a;border-radius:6px;margin-bottom:20px;">
                <tr><td style="padding:10px 16px;font-size:12px;color:#888;text-transform:uppercase;">Usuario</td></tr>
                <tr><td style="padding:0 16px 10px;font-size:16px;font-weight:bold;">${username}</td></tr>
                <tr><td style="padding:10px 16px 0;font-size:12px;color:#888;text-transform:uppercase;border-top:1px solid #eee;">Número de empleado</td></tr>
                <tr><td style="padding:0 16px 10px;font-size:16px;font-weight:bold;">${numeroEmpleado}</td></tr>
                <tr><td style="padding:10px 16px 0;font-size:12px;color:#888;text-transform:uppercase;border-top:1px solid #eee;">Correo</td></tr>
                <tr><td style="padding:0 16px 10px;font-size:16px;font-weight:bold;">${email}</td></tr>
                <tr><td style="padding:10px 16px 0;font-size:12px;color:#888;text-transform:uppercase;border-top:1px solid #eee;">Contraseña</td></tr>
                <tr><td style="padding:0 16px 14px;font-size:16px;font-weight:bold;">${password}</td></tr>
              </table>

              <p style="font-size:13px;line-height:1.6;color:#777;margin:0 0 4px;">
                Puedes iniciar sesión con tu usuario, número de empleado o correo electrónico, junto con esta contraseña.
              </p>
              <p style="font-size:13px;line-height:1.6;color:#c0392b;margin:0;">
                Por seguridad, te recomendamos cambiar tu contraseña después de tu primer inicio de sesión.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 30px;border-top:1px solid #eee;text-align:center;">
              <p style="font-size:11px;color:#aaa;margin:0;">Este es un mensaje automático, por favor no respondas a este correo.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Envía el correo de bienvenida a un usuario recién creado, con su
 * usuario, número de empleado y contraseña (en texto plano, generada
 * antes de hashearla), usando la API gratuita de Brevo.
 *
 * No lanza si el envío falla: registra el error en consola y devuelve
 * `false`, para no interrumpir el flujo de creación de usuarios.
 *
 * @param {{ nombre, username, numeroEmpleado, email }} usuario
 * @param {string} passwordPlano
 * @returns {Promise<boolean>} true si el correo se envió correctamente
 */
async function enviarCorreoBienvenida(usuario, passwordPlano) {
  const { BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME } = process.env;

  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
    console.warn('⚠️  BREVO_API_KEY / BREVO_SENDER_EMAIL no configurados (.env). No se enviarán correos de bienvenida.');
    return false;
  }

  try {
    const logoUrl = obtenerLogoUrl();
    const html = plantillaBienvenida({
      nombre:         usuario.nombre,
      username:       usuario.username,
      numeroEmpleado: usuario.numeroEmpleado,
      email:          usuario.email,
      password:       passwordPlano,
      logoUrl,
    });

    const payload = {
      sender:      { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME || 'Comercializadora de Granos La Herradura' },
      to:          [{ email: usuario.email, name: usuario.nombre }],
      subject:     'Bienvenido(a) a Comercializadora de Granos La Herradura — Datos de acceso',
      htmlContent: html,
    };

    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'api-key':      BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Brevo respondió ${response.status}: ${errBody}`);
    }

    console.log(`✓ Correo de bienvenida enviado a ${usuario.email} (Brevo)`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando correo de bienvenida:', error.message);
    return false;
  }
}

// ─── Plantilla HTML de correo de notificación (tareas) ──────────────
function plantillaNotificacion({ nombre, titulo, mensaje, logoUrl }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#333;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.06);">

          <tr>
            <td style="background:linear-gradient(135deg,#c8860a,#2d7a2d);padding:24px 30px;text-align:center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="Comercializadora de Granos La Herradura" width="52" height="52" style="border-radius:8px;background:#fff;padding:4px;display:block;margin:0 auto 8px;" />` : ''}
              <h1 style="color:#fff;font-size:18px;margin:0;">Comercializadora de Granos La Herradura · Notificación</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 30px;">
              <p style="font-size:15px;margin:0 0 14px;">Hola <strong>${nombre}</strong>,</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f7;border-left:4px solid #c8860a;border-radius:6px;margin-bottom:18px;">
                <tr><td style="padding:14px 16px;">
                  <p style="font-size:15px;font-weight:bold;margin:0 0 6px;color:#2d2a24;">${titulo}</p>
                  <p style="font-size:13px;line-height:1.5;margin:0;color:#666;">${mensaje}</p>
                </td></tr>
              </table>
              <p style="font-size:12px;line-height:1.6;color:#888;margin:0;">
                Consulta el detalle e historial completo de notificaciones dentro del Sistema de Administración de Actividades.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 30px;border-top:1px solid #eee;text-align:center;">
              <p style="font-size:11px;color:#aaa;margin:0;">Este es un mensaje automático, por favor no respondas a este correo.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Envía un correo de notificación genérico (tarea asignada, próxima a
 * vencer, vencida, completada, etc). No lanza si falla: solo registra
 * el error en consola y devuelve false, ya que estos correos son un
 * complemento del push en tiempo real y del historial, no la fuente
 * principal de verdad.
 *
 * @param {{ nombre: string, email: string }} usuario
 * @param {{ titulo: string, mensaje: string }} contenido
 * @returns {Promise<boolean>}
 */
async function enviarCorreoNotificacion(usuario, { titulo, mensaje }) {
  const { BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME } = process.env;

  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
    console.warn('⚠️  BREVO_API_KEY / BREVO_SENDER_EMAIL no configurados (.env). No se enviará el correo de notificación.');
    return false;
  }

  try {
    const logoUrl = obtenerLogoUrl();
    const html = plantillaNotificacion({
      nombre: usuario.nombre,
      titulo, mensaje,
      logoUrl,
    });

    const payload = {
      sender:      { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME || 'Comercializadora de Granos La Herradura' },
      to:          [{ email: usuario.email, name: usuario.nombre }],
      subject:     `🔔 ${titulo}`,
      htmlContent: html,
    };

    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'api-key':      BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Brevo respondió ${response.status}: ${errBody}`);
    }

    console.log(`✓ Correo de notificación enviado a ${usuario.email} (Brevo)`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando correo de notificación:', error.message);
    return false;
  }
}

module.exports = { enviarCorreoBienvenida, enviarCorreoNotificacion };
