import nodemailer from "nodemailer";

export function createTransporter(config) {
  if (!config || !config.host || !config.user) {
    throw new Error("Configuración SMTP incompleta o no proporcionada");
  }

  const port = Number(config.port) || 587;
  const isSecure = config.secure === true || config.secure === "true" || port === 465;

  return nodemailer.createTransport({
    host: config.host,
    port: port,
    secure: isSecure,
    auth: {
      user: config.user,
      pass: config.pass
    },
    tls: {
      rejectUnauthorized: false // Permite certificados autofirmados o conexiones de prueba
    }
  });
}

export async function testSMTPConnection(config) {
  const transporter = createTransporter(config);
  await transporter.verify();
  return { success: true, message: "Conexión SMTP exitosa" };
}

export async function sendDocumentEmail(config, { to, clientName, folio, tipo, total, pdfPath }) {
  if (!config || !config.host) {
    return { success: false, message: "Servidor SMTP no configurado. Guarda la configuración primero." };
  }

  const transporter = createTransporter(config);
  const fromName = config.fromName || "ConfiguroWeb POS & Facturación";
  const fromAddress = config.from || config.user;

  const docLabel = tipo === "COTIZACION" ? "Cotización Comercial" : "Factura de Venta";
  const subject = `${docLabel} ${folio} - ConfiguroWeb & Univer Workspace`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <div style="background: ${tipo === 'COTIZACION' ? '#4f46e5' : '#0284c7'}; color: #ffffff; padding: 16px 20px; border-radius: 6px; text-align: center;">
        <h2 style="margin: 0;">⚡ ${docLabel.toUpperCase()}</h2>
        <p style="margin: 4px 0 0; font-size: 14px;">Folio N° ${folio}</p>
      </div>

      <div style="padding: 20px 0;">
        <p>Estimado(a) <strong>${clientName}</strong>,</p>
        <p>Adjuntamos a este correo su documento oficial en formato PDF emitido a través de nuestro sistema integrado con <strong>Univer Workspace</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f8fafc;">
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Folio:</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${folio}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Fecha:</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${new Date().toLocaleDateString('es-CO')}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Total:</strong></td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 18px; font-weight: bold; color: #0284c7;">$${Number(total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          </tr>
        </table>

        <p style="color: #64748b; font-size: 13px;">Este documento ha sido archivado y sincronizado automáticamente en la suite de Univer Workspace (Univer Base y Univer Sheets).</p>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">

      <div style="text-align: center; color: #94a3b8; font-size: 12px;">
        <p>ConfiguroWeb Tech Solutions • Univer Workspace Self-Hosted Platform</p>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"${fromName}" <${fromAddress}>`,
    to: to,
    subject: subject,
    html: html,
    attachments: [
      {
        filename: `${folio}.pdf`,
        path: pdfPath
      }
    ]
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
}
