const express = require('express');
const router = express.Router();
const db = require('../database/db');
const aiService = require('../services/aiService');

// GET /api/settings
router.get('/', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  // Masquer les clés sensibles dans la réponse
  if (settings) {
    if (settings.anthropic_key) settings.anthropic_key = settings.anthropic_key ? '****' + settings.anthropic_key.slice(-4) : '';
    if (settings.smtp_pass) settings.smtp_pass = settings.smtp_pass ? '••••••••' : '';
  }
  res.json(settings || {});
});

// POST /api/settings
router.post('/', (req, res) => {
  try {
    const {
      company_name, company_address, company_siret, company_phone, company_email,
      depot_address, margin_material, hourly_rate, km_rate, tva_rate,
      smtp_host, smtp_port, smtp_user, smtp_pass,
      google_maps_key, anthropic_key, onedrive_enabled
    } = req.body;

    const current = db.prepare('SELECT * FROM settings WHERE id = 1').get();

    db.prepare(`
      UPDATE settings SET
        company_name = ?,
        company_address = ?,
        company_siret = ?,
        company_phone = ?,
        company_email = ?,
        depot_address = ?,
        margin_material = ?,
        hourly_rate = ?,
        km_rate = ?,
        tva_rate = ?,
        smtp_host = ?,
        smtp_port = ?,
        smtp_user = ?,
        smtp_pass = ?,
        google_maps_key = ?,
        anthropic_key = ?,
        onedrive_enabled = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      company_name || current?.company_name || '',
      company_address || current?.company_address || '',
      company_siret || current?.company_siret || '',
      company_phone || current?.company_phone || '',
      company_email || current?.company_email || '',
      depot_address || current?.depot_address || '',
      parseFloat(margin_material || current?.margin_material || 30),
      parseFloat(hourly_rate || current?.hourly_rate || 15),
      parseFloat(km_rate || current?.km_rate || 0.30),
      parseFloat(tva_rate || current?.tva_rate || 10),
      smtp_host || current?.smtp_host || '',
      parseInt(smtp_port || current?.smtp_port || 587),
      smtp_user || current?.smtp_user || '',
      smtp_pass && !smtp_pass.includes('••') ? smtp_pass : (current?.smtp_pass || ''),
      google_maps_key || current?.google_maps_key || '',
      anthropic_key && !anthropic_key.includes('****') ? anthropic_key : (current?.anthropic_key || ''),
      onedrive_enabled ? 1 : 0
    );

    // Réinitialiser le client IA si la clé a changé
    if (anthropic_key && !anthropic_key.includes('****')) {
      aiService.resetClient();
    }

    res.json({ success: true, message: 'Paramètres sauvegardés' });

  } catch (error) {
    console.error('Erreur settings:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/test-ia - Tester la connexion IA
router.post('/test-ia', async (req, res) => {
  try {
    const { content } = await require('../services/aiService').chat(
      [{ role: 'user', content: 'Test connexion. Réponds juste "OK connexion réussie".' }],
      'Test connexion. Réponds juste "OK connexion réussie".',
      null, null
    );
    res.json({ success: true, message: content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/settings/test-distance - Tester Google Maps
router.post('/test-distance', async (req, res) => {
  try {
    const { origin, destination } = req.body;
    const mapService = require('../services/mapService');
    const result = await mapService.calculateDistance(origin, destination);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
