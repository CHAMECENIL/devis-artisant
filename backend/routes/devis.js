const express = require('express');
const router = express.Router();
const db = require('../database/db');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');
const storageService = require('../services/storageService');
const pricingService = require('../services/pricingService');
const aiService = require('../services/aiService');

function generateNumero() {
  const year = new Date().getFullYear();
  const count = Number(db.prepare('SELECT COUNT(*) as c FROM devis').get().c) + 1;
  return `DEV-${year}-${String(count).padStart(4, '0')}`;
}

// POST /api/devis/generate - Générer un devis depuis une description
router.post('/generate', async (req, res) => {
  try {
    const { description, sessionId } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description requise' });
    }

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    const aiResponse = await aiService.generateDevisFromDescription(description, settings);

    // Extraire le JSON du devis de la réponse
    const jsonMatch = aiResponse.match(/```json\n?([\s\S]*?)\n?```/);
    let devisData = {};

    if (jsonMatch) {
      try {
        devisData = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error('JSON parse error:', e.message);
      }
    }

    res.json({ aiResponse, devisData, settings });

  } catch (error) {
    console.error('Erreur génération devis:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/devis - Sauvegarder un devis
router.post('/', async (req, res) => {
  try {
    const {
      clientName, clientEmail, clientAddress,
      chantierAddress, description,
      lignes = [], distanceKm = 0, dureeJours = 1,
      notes
    } = req.body;

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    const numero = generateNumero();

    // Calculer les totaux
    const devisData = { lignes, distanceKm, dureeJours, clientName, clientAddress, clientEmail, chantierAddress, description };
    const totals = pricingService.calculateTotals(devisData);

    // Générer HTML
    const htmlContent = pdfService.generateDevisHTML(devisData, settings, numero);

    // Créer ou trouver le client
    let clientId = null;
    if (clientName) {
      const existingClient = db.prepare('SELECT id FROM clients WHERE name = ? AND email = ?').get(clientName, clientEmail || '');
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const result = db.prepare('INSERT INTO clients (name, email, address) VALUES (?, ?, ?)').run(clientName, clientEmail || '', clientAddress || '');
        clientId = Number(result.lastInsertRowid);
      }
    }

    // Sauvegarder le devis
    const result = db.prepare(`
      INSERT INTO devis (
        numero, client_id, client_name, client_email, client_address,
        chantier_address, chantier_description, status,
        total_ht, total_tva, total_ttc,
        total_materials, total_labor, total_travel,
        marge_brute, taux_marge, cout_reel, rentabilite_horaire,
        duree_jours, distance_km, html_content, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      numero, clientId, clientName || '', clientEmail || '', clientAddress || '',
      chantierAddress || '', description || '', 'draft',
      totals.totalHT, totals.totalTVA, totals.totalTTC,
      totals.totalMaterials, totals.totalLabor, totals.totalTravel,
      totals.margeBrute, totals.tauxMarge, totals.coutReel, totals.rentabiliteHoraire,
      dureeJours, distanceKm, htmlContent, notes || ''
    );

    const devisId = Number(result.lastInsertRowid);

    // Sauvegarder les lignes
    if (lignes.length > 0) {
      const insertLigne = db.prepare(`
        INSERT INTO devis_lignes (devis_id, designation, unite, quantite, prix_unitaire_ht, total_ht, cout_materiau, cout_main_oeuvre, heures_mo, notes, ordre)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      lignes.forEach((ligne, i) => {
        // Accepte camelCase ET snake_case depuis le frontend
        const pu = ligne.prixUnitaireHT || ligne.prix_unitaire_ht || ligne.prix_unitaire || 0;
        const qte = ligne.quantite || 0;
        const mat = ligne.coutMateriau || ligne.cout_materiau || 0;
        const mo  = ligne.coutMainOeuvre || ligne.cout_main_oeuvre || 0;
        const hmo = ligne.heuresMO || ligne.heures_mo || 0;
        insertLigne.run(
          devisId,
          ligne.designation || '',
          ligne.unite || 'u',
          qte,
          pu,
          qte * pu,
          mat,
          mo,
          hmo,
          ligne.notes || '',
          i
        );
      });
    }

    // Sauvegarder le PDF
    try {
      const pdfBuffer = await pdfService.generatePDF(htmlContent);
      const pdfPath = await storageService.savePDF(pdfBuffer, numero);
      db.prepare('UPDATE devis SET pdf_path = ? WHERE id = ?').run(pdfPath, devisId);
    } catch (pdfErr) {
      console.error('Erreur PDF (non bloquant):', pdfErr.message);
    }

    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(Number(devisId));
    res.json({ success: true, id: Number(devisId), numero, devis, totals });

  } catch (error) {
    console.error('Erreur sauvegarde devis:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/devis - Liste des devis
router.get('/', (req, res) => {
  const { status, search, limit = 50 } = req.query;
  let query = 'SELECT * FROM devis WHERE 1=1';
  const params = [];

  if (status) { query += ' AND status = ?'; params.push(status); }
  if (search) { query += ' AND (client_name LIKE ? OR numero LIKE ? OR chantier_address LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const devis = db.prepare(query).all(...params);
  res.json(devis);
});

// GET /api/devis/:id - Détail d'un devis
router.get('/:id', (req, res) => {
  const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(req.params.id);
  if (!devis) return res.status(404).json({ error: 'Devis non trouvé' });

  const lignes = db.prepare('SELECT * FROM devis_lignes WHERE devis_id = ? ORDER BY ordre').all(devis.id);
  res.json({ ...devis, lignes });
});

// GET /api/devis/:id/pdf - Télécharger le PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(req.params.id);
    if (!devis) return res.status(404).json({ error: 'Devis non trouvé' });

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    const lignes = db.prepare('SELECT * FROM devis_lignes WHERE devis_id = ? ORDER BY ordre').all(devis.id);

    const htmlContent = devis.html_content || pdfService.generateDevisHTML(
      { ...devis, lignes, clientName: devis.client_name, clientEmail: devis.client_email, clientAddress: devis.client_address, chantierAddress: devis.chantier_address },
      settings, devis.numero
    );

    const pdfBuffer = await pdfService.generatePDF(htmlContent);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${devis.numero}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/devis/:id/rentabilite - Fiche rentabilité
router.get('/:id/rentabilite', (req, res) => {
  const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(req.params.id);
  if (!devis) return res.status(404).json({ error: 'Devis non trouvé' });

  const html = pdfService.generateRentabiliteHTMLFromDevis(devis);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// POST /api/devis/:id/send - Envoyer le devis par email
router.post('/:id/send', async (req, res) => {
  try {
    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(req.params.id);
    if (!devis) return res.status(404).json({ error: 'Devis non trouvé' });
    if (!devis.client_email) return res.status(400).json({ error: 'Email client manquant' });

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    const htmlContent = devis.html_content;
    const pdfBuffer = await pdfService.generatePDF(htmlContent);

    await emailService.sendDevisClient(devis, pdfBuffer, settings);

    db.prepare('UPDATE devis SET status = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?').run('sent', devis.id);

    // Envoyer fiche rentabilité à l'artisan
    try {
      const rentabiliteHTML = pdfService.generateRentabiliteHTMLFromDevis(devis);
      await emailService.sendRentabiliteArtisan(devis, rentabiliteHTML, settings);
    } catch (e) {
      console.error('Erreur envoi rentabilité:', e.message);
    }

    res.json({ success: true, message: `Devis envoyé à ${devis.client_email}` });

  } catch (error) {
    console.error('Erreur envoi email:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/devis/:id/status - Mettre à jour le statut
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'sent', 'accepted', 'rejected', 'archived'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Statut invalide' });

  db.prepare('UPDATE devis SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// DELETE /api/devis/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM devis WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
