const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../../storage/devis');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function savePDF(pdfBuffer, numero) {
  ensureDir(STORAGE_DIR);
  const filename = `${numero}-${Date.now()}.pdf`;
  const filePath = path.join(STORAGE_DIR, filename);
  fs.writeFileSync(filePath, pdfBuffer);
  return filePath;
}

async function saveHTML(htmlContent, numero) {
  ensureDir(STORAGE_DIR);
  const filename = `${numero}-${Date.now()}.html`;
  const filePath = path.join(STORAGE_DIR, filename);
  fs.writeFileSync(filePath, htmlContent, 'utf-8');
  return filePath;
}

function getStorageStats() {
  ensureDir(STORAGE_DIR);
  const files = fs.readdirSync(STORAGE_DIR);
  const totalSize = files.reduce((sum, f) => {
    try {
      return sum + fs.statSync(path.join(STORAGE_DIR, f)).size;
    } catch { return sum; }
  }, 0);
  return { fileCount: files.length, totalSize };
}

module.exports = { savePDF, saveHTML, getStorageStats };
