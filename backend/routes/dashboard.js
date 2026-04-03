const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/dashboard/stats - Statistiques globales
router.get('/stats', (req, res) => {
  try {
    // KPIs globaux
    const global = db.prepare(`
      SELECT
        COUNT(*) as totalDevis,
        COUNT(CASE WHEN status = 'sent' OR status = 'accepted' THEN 1 END) as devisEnvoyes,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as devisAcceptes,
        COALESCE(SUM(CASE WHEN status = 'accepted' THEN total_ht END), 0) as caTotal,
        COALESCE(AVG(taux_marge), 0) as margeMoyenne,
        COALESCE(AVG(total_ht), 0) as panierMoyen,
        COALESCE(SUM(total_ht), 0) as caTotalDevis
      FROM devis
    `).get();

    // CA par mois (12 derniers mois)
    const caParMois = db.prepare(`
      SELECT
        strftime('%Y-%m', created_at) as mois,
        COUNT(*) as nbDevis,
        COALESCE(SUM(total_ht), 0) as caHT,
        COALESCE(AVG(taux_marge), 0) as margeMoyenne
      FROM devis
      WHERE created_at >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY mois ASC
    `).all();

    // Top clients
    const topClients = db.prepare(`
      SELECT
        client_name,
        COUNT(*) as nbDevis,
        COALESCE(SUM(total_ht), 0) as caTotal,
        COALESCE(AVG(taux_marge), 0) as margeMoyenne
      FROM devis
      WHERE client_name IS NOT NULL AND client_name != ''
      GROUP BY client_name
      ORDER BY caTotal DESC
      LIMIT 5
    `).all();

    // Distribution des marges
    const distribMarge = db.prepare(`
      SELECT
        CASE
          WHEN taux_marge < 20 THEN 'Faible (<20%)'
          WHEN taux_marge < 30 THEN 'Correct (20-30%)'
          WHEN taux_marge < 40 THEN 'Bon (30-40%)'
          ELSE 'Excellent (>40%)'
        END as tranche,
        COUNT(*) as count
      FROM devis
      GROUP BY tranche
    `).all();

    // Devis récents
    const devisRecents = db.prepare(`
      SELECT id, numero, client_name, total_ttc, taux_marge, status, created_at
      FROM devis
      ORDER BY created_at DESC
      LIMIT 5
    `).all();

    // Statuts
    const statuts = db.prepare(`
      SELECT status, COUNT(*) as count FROM devis GROUP BY status
    `).all();

    res.json({
      global,
      caParMois,
      topClients,
      distribMarge,
      devisRecents,
      statuts
    });

  } catch (error) {
    console.error('Erreur dashboard:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
