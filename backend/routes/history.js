const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/history - Historique des devis avec filtres
router.get('/', (req, res) => {
  const { search, status, dateFrom, dateTo, minMarge, maxMarge, sortBy = 'created_at', order = 'DESC', limit = 50, offset = 0 } = req.query;

  let query = 'SELECT * FROM devis WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (client_name LIKE ? OR numero LIKE ? OR chantier_address LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (dateFrom) { query += ' AND date(created_at) >= ?'; params.push(dateFrom); }
  if (dateTo) { query += ' AND date(created_at) <= ?'; params.push(dateTo); }
  if (minMarge) { query += ' AND taux_marge >= ?'; params.push(parseFloat(minMarge)); }
  if (maxMarge) { query += ' AND taux_marge <= ?'; params.push(parseFloat(maxMarge)); }

  const validSort = ['created_at', 'total_ttc', 'taux_marge', 'client_name', 'numero'];
  const sortCol = validSort.includes(sortBy) ? sortBy : 'created_at';
  const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

  query += ` ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  const devis = db.prepare(query).all(...params);

  // Total count
  let countQuery = 'SELECT COUNT(*) as total FROM devis WHERE 1=1';
  const countParams = params.slice(0, -2);
  if (search) { countQuery += ' AND (client_name LIKE ? OR numero LIKE ? OR chantier_address LIKE ?)'; }
  if (status) { countQuery += ' AND status = ?'; }

  const total = db.prepare('SELECT COUNT(*) as total FROM devis').get().total;

  res.json({ devis, total, limit: parseInt(limit), offset: parseInt(offset) });
});

module.exports = router;
