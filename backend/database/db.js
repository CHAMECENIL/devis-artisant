const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../database/devis.db');

// Créer le répertoire si nécessaire
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialisation du schéma
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    company_name TEXT DEFAULT '',
    company_address TEXT DEFAULT '',
    company_siret TEXT DEFAULT '',
    company_phone TEXT DEFAULT '',
    company_email TEXT DEFAULT '',
    company_logo TEXT DEFAULT '',
    depot_address TEXT DEFAULT '',
    margin_material REAL DEFAULT 30,
    hourly_rate REAL DEFAULT 15,
    km_rate REAL DEFAULT 0.30,
    tva_rate REAL DEFAULT 10,
    smtp_host TEXT DEFAULT '',
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT DEFAULT '',
    smtp_pass TEXT DEFAULT '',
    google_maps_key TEXT DEFAULT '',
    anthropic_key TEXT DEFAULT '',
    onedrive_enabled INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS devis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE NOT NULL,
    client_id INTEGER REFERENCES clients(id),
    client_name TEXT,
    client_email TEXT,
    client_address TEXT,
    chantier_address TEXT,
    chantier_description TEXT,
    status TEXT DEFAULT 'draft',
    total_ht REAL DEFAULT 0,
    total_tva REAL DEFAULT 0,
    total_ttc REAL DEFAULT 0,
    total_materials REAL DEFAULT 0,
    total_labor REAL DEFAULT 0,
    total_travel REAL DEFAULT 0,
    marge_brute REAL DEFAULT 0,
    taux_marge REAL DEFAULT 0,
    cout_reel REAL DEFAULT 0,
    rentabilite_horaire REAL DEFAULT 0,
    duree_jours INTEGER DEFAULT 1,
    distance_km REAL DEFAULT 0,
    html_content TEXT,
    pdf_path TEXT,
    sent_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS devis_lignes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    devis_id INTEGER REFERENCES devis(id) ON DELETE CASCADE,
    designation TEXT NOT NULL,
    unite TEXT DEFAULT 'u',
    quantite REAL DEFAULT 1,
    prix_unitaire_ht REAL DEFAULT 0,
    total_ht REAL DEFAULT 0,
    cout_materiau REAL DEFAULT 0,
    cout_main_oeuvre REAL DEFAULT 0,
    heures_mo REAL DEFAULT 0,
    notes TEXT,
    ordre INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    has_image INTEGER DEFAULT 0,
    devis_id INTEGER REFERENCES devis(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    filename TEXT NOT NULL,
    original_name TEXT,
    mimetype TEXT,
    size INTEGER,
    path TEXT,
    analysis TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Insérer les paramètres par défaut si vides
  INSERT OR IGNORE INTO settings (id) VALUES (1);
`);

// Mettre à jour depuis .env si settings vides
const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
if (settings && !settings.company_name && process.env.COMPANY_NAME) {
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
      google_maps_key = ?,
      anthropic_key = ?
    WHERE id = 1
  `).run(
    process.env.COMPANY_NAME || '',
    process.env.COMPANY_ADDRESS || '',
    process.env.COMPANY_SIRET || '',
    process.env.COMPANY_PHONE || '',
    process.env.COMPANY_EMAIL || '',
    process.env.COMPANY_DEPOT_ADDRESS || '',
    parseFloat(process.env.DEFAULT_MARGIN_MATERIAL || '30'),
    parseFloat(process.env.DEFAULT_HOURLY_RATE || '15'),
    parseFloat(process.env.DEFAULT_KM_RATE || '0.30'),
    parseFloat(process.env.DEFAULT_TVA || '10'),
    process.env.GOOGLE_MAPS_API_KEY || '',
    process.env.ANTHROPIC_API_KEY || ''
  );
}

module.exports = db;
