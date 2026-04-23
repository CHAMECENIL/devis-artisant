const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/stats', (req, res) => {
  try {
    const global = db.prepare(`
      SELECT
        COUNT(*) as totalDevis,
        COUNT(CASE WHEN status IN ('sent','signed','accepted') THEN 1 END) as devisEnvoyes,
        COUNT(CASE WHEN status IN ('signed','accepted') THEN 1 END) as devisAcceptes,
        COALESCE(SUM(CASE WHEN status IN ('signed','accepted') THEN total_ht END), 0) as caTotal,
        COALESCE(SUM(total_ht), 0) as caTotalDevis,
        COALESCE(AVG(taux_marge), 0) as margeMoyenne,
        COALESCE(AVG(total_ht), 0) as panierMoyen,
        COALESCE(SUM(marge_brute), 0) as margeBruteTotal,
        COALESCE(SUM(cout_reel), 0) as coutReelTotal
      FROM devis
    `).get();

    // CA par mois — format byMonth pour le frontend
    const caParMois = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month,
             COUNT(*) as nbDevis,
             COALESCE(SUM(total_ht), 0) as caHT,
             COALESCE(AVG(taux_marge), 0) as margeMoyenne
      FROM devis
      WHERE created_at >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month ASC
    `).all();

    // Statuts — format byStatus {draft: N, sent: N, ...}
    const statutsArr = db.prepare('SELECT status, COUNT(*) as count FROM devis GROUP BY status').all();
    const byStatus = {};
    statutsArr.forEach(s => { byStatus[s.status] = Number(s.count); });

    // Distribution marges — format marginDistribution {faible: N, correct: N, bon: N, excellent: N}
    const distribArr = db.prepare(`
      SELECT CASE
        WHEN taux_marge < 20 THEN 'faible'
        WHEN taux_marge < 30 THEN 'correct'
        WHEN taux_marge < 40 THEN 'bon'
        ELSE 'excellent'
      END as tranche, COUNT(*) as count FROM devis GROUP BY tranche
    `).all();
    const marginDistribution = { faible: 0, correct: 0, bon: 0, excellent: 0 };
    distribArr.forEach(d => { marginDistribution[d.tranche] = Number(d.count); });

    // Top clients — format avec .name
    const topClients = db.prepare(`
      SELECT client_name as name, COUNT(*) as nbDevis,
             COALESCE(SUM(total_ht), 0) as caTotal,
             COALESCE(AVG(taux_marge), 0) as margeMoyenne
      FROM devis WHERE client_name IS NOT NULL AND client_name != ''
      GROUP BY client_name ORDER BY caTotal DESC LIMIT 5
    `).all();

    // Devis récents
    const recentDevis = db.prepare(`
      SELECT id, numero, client_name, total_ttc, taux_marge, status, created_at
      FROM devis ORDER BY created_at DESC LIMIT 8
    `).all();

    // Kanban stats
    const kanbanStats = db.prepare(`
      SELECT kanban_stage, COUNT(*) as count
      FROM devis WHERE status != 'archived'
      GROUP BY kanban_stage
    `).all();

    // Rentabilité stats
    const rentabilite = db.prepare(`
      SELECT
        COALESCE(AVG(rentabilite_horaire), 0) as rentabiliteHoraireAvg,
        COALESCE(SUM(total_materials), 0) as totalMaterialsSum,
        COALESCE(SUM(total_labor), 0) as totalLaborSum,
        COALESCE(SUM(total_travel), 0) as totalTravelSum
      FROM devis WHERE status IN ('signed','accepted')
    `).get();

    res.json({
      global,
      byMonth: caParMois,
      byStatus,
      marginDistribution,
      topClients,
      recentDevis,
      kanbanStats,
      rentabilite
    });

  } catch (error) {
    console.error('Erreur dashboard:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
