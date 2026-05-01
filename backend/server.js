require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Créer les répertoires nécessaires
['uploads', 'storage/devis', 'database'].forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// Routes API
app.use('/api/chat', require('./routes/chat'));
app.use('/api/devis', require('./routes/devis'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/history', require('./routes/history'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/signature', require('./routes/signature'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/kanban', require('./routes/kanban'));

// Page de signature publique (accès client sans auth)
app.get('/sign/:token', (req, res) => {
  // Servir via la route signature
  const signatureRouter = require('./routes/signature');
  req.params = { token: req.params.token };
  // Redirect interne
  res.redirect(`/api/signature/page/${req.params.token}`);
});

// Frontend statique
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Catch-all SPA (sauf /sign/)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/sign/')) return;
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  const { isDemoMode } = require('./services/aiService');
  const demo = isDemoMode();
  console.log(`\n✅ Devis Artisant démarré → http://localhost:${PORT}`);
  console.log(demo ? `⚠️  MODE DÉMO actif` : `🤖 IA Anthropic connectée`);
  console.log(`📂 Ouvrez http://localhost:${PORT} dans votre navigateur\n`);
});

module.exports = app;
