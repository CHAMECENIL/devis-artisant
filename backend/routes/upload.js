const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const aiService = require('../services/aiService');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG, PDF ou WebP.'));
    }
  }
});

// POST /api/upload - Upload + analyse IA
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });

    const { sessionId } = req.body;
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    // Enregistrer en DB
    const result = db.prepare(`
      INSERT INTO uploads (session_id, filename, original_name, mimetype, size, path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId || null, req.file.filename, req.file.originalname, mimeType, req.file.size, filePath);

    // Analyser si c'est une image
    let analysis = null;
    if (mimeType.startsWith('image/')) {
      const base64 = fs.readFileSync(filePath).toString('base64');
      analysis = await aiService.analyzeImage(base64, mimeType);

      db.prepare('UPDATE uploads SET analysis = ? WHERE id = ?').run(analysis, result.lastInsertRowid);
    }

    // URL publique
    const publicUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      file: {
        id: result.lastInsertRowid,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType,
        size: req.file.size,
        url: publicUrl
      },
      analysis
    });

  } catch (error) {
    console.error('Erreur upload:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
