const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/reminders/templates — Lire les templates
router.get('/templates', (req, res) => {
  const templates = db.prepare('SELECT * FROM email_templates ORDER BY id').all();
  res.json(templates);
});

// PUT /api/reminders/templates/:id — Modifier un template
router.put('/templates/:id', (req, res) => {
  const { subject, body, enabled, delay_days } = req.body;
  db.prepare('UPDATE email_templates SET subject=?, body=?, enabled=?, delay_days=? WHERE id=?')
    .run(subject, body, enabled ? 1 : 0, parseInt(delay_days || 3), req.params.id);
  res.json({ success: true });
});

// POST /api/reminders/send — Envoyer une relance manuelle
router.post('/send', async (req, res) => {
  const { devisId, type } = req.body;
  if (!devisId || !type) return res.status(400).json({ error: 'devisId et type requis' });

  const devis = db.prepare('SELECT * FROM devis WHERE id=?').get(devisId);
  if (!devis) return res.status(404).json({ error: 'Devis non trouvé' });
  if (!devis.client_email) return res.status(400).json({ error: 'Email client manquant' });

  const template = db.prepare('SELECT * FROM email_templates WHERE type=?').get(type);
  if (!template) return res.status(404).json({ error: 'Template non trouvé' });

  const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
  if (!settings?.smtp_user) return res.status(400).json({ error: 'SMTP non configuré dans Paramètres' });

  try {
    // Interpoler le template
    const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const signLink = devis.signature_token ? `${baseUrl}/sign/${devis.signature_token}` : '';
    const acompte = devis.acompte_amount > 0
      ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(devis.acompte_amount)
      : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(devis.total_ttc * 0.3);

    const interpolate = (str) => str
      .replace(/{{numero}}/g, devis.numero)
      .replace(/{{client_name}}/g, devis.client_name || '')
      .replace(/{{total_ttc}}/g, new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(devis.total_ttc))
      .replace(/{{total_ht}}/g, new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(devis.total_ht))
      .replace(/{{company_name}}/g, settings.company_name || '')
      .replace(/{{signature_link}}/g, signLink)
      .replace(/{{acompte_amount}}/g, acompte)
      .replace(/{{chantier_address}}/g, devis.chantier_address || '');

    const subject = interpolate(template.subject);
    const bodyText = interpolate(template.body);

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransporter({
      host: settings.smtp_host || 'smtp.gmail.com', port: settings.smtp_port || 587,
      secure: false, auth: { user: settings.smtp_user, pass: settings.smtp_pass }
    });

    const htmlBody = bodyText.split('\n').map(l => `<p style="margin:0 0 8px">${l}</p>`).join('');

    await transporter.sendMail({
      from: `"${settings.company_name}" <${settings.smtp_user}>`,
      to: devis.client_email,
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a56db;color:white;padding:16px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;font-size:18px">${settings.company_name}</h2>
        </div>
        <div style="background:#f8f9fa;padding:24px;border-radius:0 0 8px 8px">${htmlBody}</div>
      </div>`
    });

    // Loguer la relance
    db.prepare('INSERT INTO reminders_log (devis_id, type, recipient, status) VALUES (?,?,?,?)').run(devisId, type, devis.client_email, 'sent');
    db.prepare('UPDATE devis SET last_reminder_at=CURRENT_TIMESTAMP, reminder_count=reminder_count+1, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(devisId);

    res.json({ success: true, message: `Relance "${template.label}" envoyée à ${devis.client_email}` });

  } catch (err) {
    db.prepare('INSERT INTO reminders_log (devis_id, type, recipient, status, error_msg) VALUES (?,?,?,?,?)').run(devisId, type, devis.client_email, 'error', err.message);
    console.error('Erreur relance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reminders/log/:devisId — Historique des relances pour un devis
router.get('/log/:devisId', (req, res) => {
  const logs = db.prepare('SELECT * FROM reminders_log WHERE devis_id=? ORDER BY sent_at DESC').all(req.params.devisId);
  res.json(logs);
});

module.exports = router;
