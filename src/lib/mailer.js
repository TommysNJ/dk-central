import nodemailer from "nodemailer";

/**
 * ===============================
 * TRANSPORTER SMTP
 * ===============================
 *
 * 🔹 DEV / QA:
 *   Usa Gmail con App Password
 *
 * 🔹 PROD (comentado):
 *   Outlook + Azure OAuth2
 */

// ===============================
// 🔹 CONFIGURACIÓN ACTUAL (GMAIL)
// ===============================
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,       // smtp.gmail.com
  port: Number(process.env.SMTP_PORT), // 587
  secure: false,
  auth: {
    user: process.env.SMTP_USER,     // correo@gmail.com
    pass: process.env.SMTP_PASS,     // App Password
  },
});

/*
// ===============================
// 🔒 CONFIGURACIÓN PROD (OUTLOOK + AZURE OAUTH2)
// ===============================
// ⚠️ ACTIVAR SOLO CUANDO DKMS TENGA AZURE AD

export const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    type: "OAuth2",
    user: process.env.SMTP_USER, // notificaciones@dkms.com.ec
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    refreshToken: process.env.OAUTH_REFRESH_TOKEN,
  },
});
*/

/**
 * ===============================
 * Enviar correo de creación de usuario
 * ===============================
 */
export async function sendUserCreatedEmail({
  to,
  nombre,
  usuario,
  password,
  adminNombre,
  adminCorreo,
}) {
  const fromEmail = process.env.SMTP_USER;
  // const fromEmail = "notificaciones@dkms.com.ec"; // 🔒 PRODUCCIÓN

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6">
      <h2>Cuenta creada</h2>

      <p>Hola <strong>${nombre}</strong>,</p>

      <p>Se ha creado una cuenta para ti en el sistema.</p>

      <p>
        <strong>Usuario:</strong> ${usuario}<br/>
        <strong>Contraseña:</strong> ${password}
      </p>

      <p>Por seguridad, cambia tu contraseña al iniciar sesión.</p>

      <hr />
      <p style="font-size: 12px; color: #666">
        Cuenta creada por: ${adminNombre} (${adminCorreo})
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${adminNombre} (Administrador)" <${fromEmail}>`,
    replyTo: adminCorreo, // responde al admin real
    to,
    subject: "Creación de cuenta",
    html,
  });
}