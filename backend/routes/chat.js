const express = require('express');
const router = express.Router();
const db = require('../database/db');
const aiService = require('../services/aiService');

// POST /api/chat - Envoyer un message
router.post('/', async (req, res) => {
  try {
    const { message, sessionId, imageBase64, imageMimeType } = req.body;

    if (!message && !imageBase64) {
      return res.status(400).json({ error: 'Message ou image requis' });
    }

    const sid = sessionId || `session_${Date.now()}`;

    // Sauvegarder le message utilisateur
    db.prepare(`
      INSERT INTO conversations (session_id, role, content, has_image)
      VALUES (?, 'user', ?, ?)
    `).run(sid, message || '[Image envoyée]', imageBase64 ? 1 : 0);

    // Récupérer l'historique de la session (30 derniers messages)
    const history = db.prepare(`
      SELECT role, content FROM conversations
      WHERE session_id = ?
      ORDER BY created_at ASC
      LIMIT 30
    `).all(sid);

    // Appel IA
    const { content } = await aiService.chat(history, message, imageBase64, imageMimeType);

    // Sauvegarder la réponse IA
    db.prepare(`
      INSERT INTO conversations (session_id, role, content)
      VALUES (?, 'assistant', ?)
    `).run(sid, content);

    res.json({ response: content, sessionId: sid });

  } catch (error) {
    console.error('Erreur chat:', error.message);
    res.status(500).json({ error: error.message || 'Erreur lors de la conversation' });
  }
});

// DELETE /api/chat/:sessionId - Effacer une session
router.delete('/:sessionId', (req, res) => {
  db.prepare('DELETE FROM conversations WHERE session_id = ?').run(req.params.sessionId);
  res.json({ success: true });
});

// GET /api/chat/sessions - Lister les sessions
router.get('/sessions', (req, res) => {
  const sessions = db.prepare(`
    SELECT session_id,
           MIN(created_at) as started_at,
           MAX(created_at) as last_at,
           COUNT(*) as message_count
    FROM conversations
    GROUP BY session_id
    ORDER BY last_at DESC
    LIMIT 20
  `).all();
  res.json(sessions);
});

module.exports = router;
