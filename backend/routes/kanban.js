const express = require('express');
const router = express.Router();
const db = require('../database/db');

const STAGES = ['devis', 'signed', 'acompte', 'in_progress', 'done'];

// GET /api/kanban — Tous les devis organisés par étape
router.get('/', (req, res) => {
  const board = {};
  STAGES.forEach(stage => {
    board[stage] = db.prepare(`
      SELECT id, numero, client_name, client_email, chantier_address,
             total_ttc, taux_marge, status, kanban_stage,
             signed_at, acompte_received_at, created_at, updated_at,
             reminder_count, last_reminder_at
      FROM devis
      WHERE kanban_stage=? AND status != 'archived'
      ORDER BY updated_at DESC
    `).all(stage);
  });
  res.json(board);
});

// PATCH /api/kanban/:id/move — Déplacer une carte
router.patch('/:id/move', (req, res) => {
  const { stage } = req.body;
  if (!STAGES.includes(stage)) return res.status(400).json({ error: 'Étape invalide' });

  // Mapper kanban_stage → status
  const statusMap = {
    devis: 'draft',
    signed: 'signed',
    acompte: 'accepted',
    in_progress: 'accepted',
    done: 'accepted'
  };

  db.prepare('UPDATE devis SET kanban_stage=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(stage, statusMap[stage] || 'draft', req.params.id);

  res.json({ success: true });
});

// POST /api/kanban/:id/acompte — Enregistrer réception acompte
router.post('/:id/acompte', (req, res) => {
  const { amount } = req.body;
  db.prepare('UPDATE devis SET acompte_amount=?, acompte_received_at=CURRENT_TIMESTAMP, kanban_stage=\'acompte\', updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(parseFloat(amount || 0), req.params.id);
  res.json({ success: true });
});

module.exports = router;
