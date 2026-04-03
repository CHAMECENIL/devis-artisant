const nodemailer = require('nodemailer');
const db = require('../database/db');

function createTransporter(settings) {
  return nodemailer.createTransporter({
    host: settings.smtp_host || 'smtp.gmail.com',
    port: settings.smtp_port || 587,
    secure: false,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass
    }
  });
}

async function sendDevisClient(devis, pdfBuffer, settings) {
  if (!settings?.smtp_user || !settings?.smtp_pass) {
    throw new Error('SMTP non configuré. Allez dans Paramètres pour configurer l\'email.');
  }

  const transporter = createTransporter(settings);

  await transporter.sendMail({
    from: `"${settings.company_name}" <${settings.smtp_user}>`,
    to: devis.client_email,
    subject: `Votre devis ${devis.numero} - ${settings.company_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a56db; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">${settings.company_name}</h1>
        </div>
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Bonjour <strong>${devis.client_name}</strong>,</p>
          <p>Suite à notre échange, veuillez trouver ci-joint votre devis <strong>N° ${devis.numero}</strong>.</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Chantier :</strong> ${devis.chantier_address}</p>
            <p><strong>Montant TTC :</strong> ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(devis.total_ttc)}</p>
          </div>
          <p>Ce devis est valable 30 jours. Pour toute question, n'hésitez pas à nous contacter.</p>
          <p>Cordialement,<br><strong>${settings.company_name}</strong></p>
          <p style="font-size: 11px; color: #6b7280;">${settings.company_phone} | ${settings.company_email}</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `${devis.numero}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
}

async function sendRentabiliteArtisan(devis, rentabiliteHTML, settings) {
  if (!settings?.smtp_user || !settings?.smtp_pass || !settings?.company_email) {
    console.log('SMTP non configuré, fiche rentabilité non envoyée');
    return;
  }

  const transporter = createTransporter(settings);

  await transporter.sendMail({
    from: `"Devis Artisant - Interne" <${settings.smtp_user}>`,
    to: settings.company_email,
    subject: `[INTERNE] Fiche rentabilité - ${devis.numero} - ${devis.client_name}`,
    html: rentabiliteHTML
  });
}

module.exports = { sendDevisClient, sendRentabiliteArtisan };
