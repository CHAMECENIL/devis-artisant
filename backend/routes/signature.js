const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const emailService = require('../services/emailService');

// POST /api/signature/:id/send — Envoyer pour signature électronique
router.post('/:id/send', async (req, res) => {
  try {
    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(req.params.id);
    if (!devis) return res.status(404).json({ error: 'Devis non trouvé' });
    if (!devis.client_email) return res.status(400).json({ error: 'Email client manquant' });

    const token = uuidv4();
    db.prepare('UPDATE devis SET signature_token=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(token, 'sent', devis.id);

    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const signLink = `${baseUrl}/sign/${token}`;

    // Envoyer email avec lien de signature
    if (settings?.smtp_user && settings?.smtp_pass) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransporter({
        host: settings.smtp_host || 'smtp.gmail.com',
        port: settings.smtp_port || 587,
        secure: false,
        auth: { user: settings.smtp_user, pass: settings.smtp_pass }
      });

      const pdfService = require('../services/pdfService');
      const pdfBuffer = await pdfService.generatePDF(devis.html_content || '');

      await transporter.sendMail({
        from: `"${settings.company_name}" <${settings.smtp_user}>`,
        to: devis.client_email,
        subject: `Devis ${devis.numero} — Signature électronique requise`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1a56db;color:white;padding:20px;border-radius:8px 8px 0 0">
              <h2 style="margin:0">${settings.company_name || 'Votre artisan'}</h2>
            </div>
            <div style="background:#f8f9fa;padding:30px;border-radius:0 0 8px 8px">
              <p>Bonjour <strong>${devis.client_name}</strong>,</p>
              <p>Votre devis <strong>N° ${devis.numero}</strong> est prêt pour signature.</p>
              <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0">
                <p><strong>Montant TTC :</strong> ${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(devis.total_ttc)}</p>
                <p><strong>Chantier :</strong> ${devis.chantier_address || ''}</p>
              </div>
              <div style="text-align:center;margin:30px 0">
                <a href="${signLink}" style="background:#1a56db;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
                  ✍️ Signer le devis électroniquement
                </a>
              </div>
              <p style="font-size:12px;color:#6b7280">Ce lien est personnel et sécurisé. En signant, vous acceptez le devis ci-joint.</p>
              <p>Cordialement,<br><strong>${settings.company_name}</strong></p>
            </div>
          </div>`,
        attachments: [{ filename: `${devis.numero}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      });
    }

    db.prepare('UPDATE devis SET sent_at=CURRENT_TIMESTAMP WHERE id=?').run(devis.id);
    res.json({ success: true, signLink, token, message: `Email de signature envoyé à ${devis.client_email}` });

  } catch (err) {
    console.error('Erreur envoi signature:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /sign/:token — Page de signature publique (HTML)
router.get('/page/:token', (req, res) => {
  const devis = db.prepare('SELECT * FROM devis WHERE signature_token=?').get(req.params.token);
  if (!devis) return res.status(404).send('<h1>Lien invalide ou expiré</h1>');
  if (devis.signed_at) return res.send(`
    <html><body style="font-family:Arial;text-align:center;padding:60px">
      <div style="background:#dcfce7;border:2px solid #22c55e;border-radius:12px;padding:40px;max-width:500px;margin:0 auto">
        <h1 style="color:#16a34a">✅ Devis déjà signé</h1>
        <p>Ce devis a été signé le ${new Date(devis.signed_at).toLocaleDateString('fr-FR')} par ${devis.signed_by}.</p>
      </div>
    </body></html>`);

  const devisHtml = devis.html_content || '<p>Contenu du devis non disponible</p>';

  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Signature — Devis ${devis.numero}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#f3f4f6;min-height:100vh}
    .header{background:#1a56db;color:white;padding:20px;text-align:center}
    .container{max-width:900px;margin:0 auto;padding:20px}
    .devis-frame{background:white;border-radius:8px;padding:20px;margin:20px 0;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
    .sign-box{background:white;border-radius:12px;border:2px solid #1a56db;padding:30px;margin:20px 0;box-shadow:0 4px 12px rgba(26,86,219,0.15)}
    .sign-box h2{color:#1a56db;margin-bottom:20px}
    .form-group{margin:15px 0}
    label{display:block;font-weight:bold;margin-bottom:6px;font-size:14px}
    input[type=text]{width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:15px}
    .checkbox-row{display:flex;gap:10px;align-items:flex-start;padding:15px;background:#f8f9fa;border-radius:8px;margin:15px 0}
    input[type=checkbox]{margin-top:3px;width:18px;height:18px;accent-color:#1a56db}
    .btn-sign{background:#1a56db;color:white;border:none;padding:16px 40px;border-radius:8px;font-size:17px;font-weight:bold;cursor:pointer;width:100%;margin-top:20px}
    .btn-sign:disabled{background:#9ca3af;cursor:not-allowed}
    .success{background:#dcfce7;border:2px solid #22c55e;border-radius:12px;padding:30px;text-align:center;display:none}
    .success h2{color:#16a34a}
    .info-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:15px;font-size:13px;color:#1e40af;margin-bottom:15px}
  </style>
</head>
<body>
  <div class="header">
    <h1>Signature Électronique — Devis ${devis.numero}</h1>
    <p style="margin-top:8px;opacity:0.85">Lisez attentivement le devis ci-dessous avant de signer</p>
  </div>
  <div class="container">
    <div class="devis-frame">${devisHtml}</div>

    <div class="sign-box" id="sign-form">
      <h2>✍️ Bon pour accord — Signature électronique</h2>
      <div class="info-box">
        🔒 Votre signature électronique a la même valeur légale qu'une signature manuscrite (Règlement eIDAS, Art. 25).
        Elle est horodatée et liée à votre adresse email.
      </div>
      <div class="form-group">
        <label>Votre nom complet *</label>
        <input type="text" id="signer-name" placeholder="Ex: Jean Dupont" required>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="checkbox-accept">
        <label for="checkbox-accept">J'ai lu et j'accepte le devis n° ${devis.numero} d'un montant de
          <strong>${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(devis.total_ttc)}</strong>
          TTC. Je consens à sa signature électronique.</label>
      </div>
      <button class="btn-sign" id="btn-sign" disabled onclick="signDevis()">
        ✍️ Je signe électroniquement ce devis
      </button>
      <p style="font-size:11px;color:#6b7280;margin-top:12px;text-align:center">
        En signant, votre nom, la date et votre adresse IP seront enregistrés comme preuve.
      </p>
    </div>

    <div class="success" id="success-box">
      <h2>✅ Devis signé avec succès !</h2>
      <p style="margin-top:15px;font-size:16px">Merci <strong id="success-name"></strong>. Votre signature a été enregistrée.</p>
      <p style="margin-top:10px;color:#6b7280">Vous recevrez une confirmation par email. L'artisan a été notifié.</p>
    </div>
  </div>
  <script>
    document.getElementById('checkbox-accept').addEventListener('change', function() {
      document.getElementById('btn-sign').disabled = !this.checked;
    });

    async function signDevis() {
      const name = document.getElementById('signer-name').value.trim();
      if (!name) { alert('Veuillez entrer votre nom complet.'); return; }

      const btn = document.getElementById('btn-sign');
      btn.disabled = true;
      btn.textContent = 'Enregistrement...';

      try {
        const resp = await fetch('/api/signature/sign/${req.params.token}', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ signerName: name })
        });
        const data = await resp.json();
        if (data.success) {
          document.getElementById('sign-form').style.display = 'none';
          document.getElementById('success-box').style.display = 'block';
          document.getElementById('success-name').textContent = name;
        } else {
          alert('Erreur : ' + data.error);
          btn.disabled = false;
          btn.textContent = '✍️ Je signe électroniquement ce devis';
        }
      } catch(e) {
        alert('Erreur réseau. Réessayez.');
        btn.disabled = false;
        btn.textContent = '✍️ Je signe électroniquement ce devis';
      }
    }
  </script>
</body>
</html>`);
});

// POST /api/signature/sign/:token — Enregistrer la signature
router.post('/sign/:token', async (req, res) => {
  try {
    const devis = db.prepare('SELECT * FROM devis WHERE signature_token=?').get(req.params.token);
    if (!devis) return res.status(404).json({ error: 'Lien invalide ou expiré' });
    if (devis.signed_at) return res.status(400).json({ error: 'Devis déjà signé' });

    const { signerName } = req.body;
    if (!signerName) return res.status(400).json({ error: 'Nom du signataire requis' });

    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = new Date().toISOString();

    db.prepare(`UPDATE devis SET signed_at=?, signed_by=?, signed_ip=?, status='signed', kanban_stage='signed', updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(now, signerName, ip, devis.id);

    // Notifier l'artisan
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    if (settings?.smtp_user && settings?.smtp_pass && settings?.company_email) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransporter({
          host: settings.smtp_host || 'smtp.gmail.com', port: settings.smtp_port || 587,
          secure: false, auth: { user: settings.smtp_user, pass: settings.smtp_pass }
        });
        await transporter.sendMail({
          from: `"Devis Artisant" <${settings.smtp_user}>`,
          to: settings.company_email,
          subject: `✅ Devis ${devis.numero} signé par ${signerName}`,
          html: `<p>Le devis <strong>${devis.numero}</strong> a été signé électroniquement par <strong>${signerName}</strong> (${devis.client_email}) le ${new Date(now).toLocaleString('fr-FR')}.</p><p>Adresse IP : ${ip}</p>`
        });
      } catch(e) { console.error('Notif artisan:', e.message); }
    }

    res.json({ success: true, message: 'Devis signé avec succès', signedAt: now, signedBy: signerName });

  } catch (err) {
    console.error('Erreur signature:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
