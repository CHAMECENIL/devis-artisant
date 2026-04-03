const path = require('path');
const fs = require('fs');

function generateDevisHTML(devisData, settings, numero) {
  const today = new Date().toLocaleDateString('fr-FR');
  const validite = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR');

  const lignes = devisData.lignes || [];
  let totalHT = 0;
  const tvaRate = settings?.tva_rate || devisData.tvaRate || 10;

  const lignesHTML = lignes.map(ligne => {
    const total = (ligne.quantite || 0) * (ligne.prixUnitaireHT || 0);
    totalHT += total;
    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: left;">${ligne.designation || ''}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${ligne.quantite || 0} ${ligne.unite || 'u'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatEuro(ligne.prixUnitaireHT || 0)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${formatEuro(total)}</td>
      </tr>
    `;
  }).join('');

  // Frais de déplacement
  const distanceKm = parseFloat(devisData.distanceKm || 0);
  const dureeJours = parseInt(devisData.dureeJours || 1);
  const kmRate = settings?.km_rate || 0.30;
  const fraisDeplacement = distanceKm * 2 * kmRate * dureeJours;

  if (fraisDeplacement > 0) {
    totalHT += fraisDeplacement;
  }

  const totalTVA = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + totalTVA;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #333; background: white; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #1a56db; }
    .company-info h1 { font-size: 22px; color: #1a56db; margin-bottom: 5px; }
    .company-info p { color: #666; line-height: 1.6; }
    .devis-info { text-align: right; }
    .devis-info .numero { font-size: 18px; font-weight: bold; color: #1a56db; }
    .devis-info .date { color: #666; margin-top: 5px; }
    .parties { display: flex; gap: 40px; margin-bottom: 30px; }
    .partie { flex: 1; background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #1a56db; }
    .partie h3 { font-size: 11px; text-transform: uppercase; color: #1a56db; margin-bottom: 10px; letter-spacing: 1px; }
    .partie p { line-height: 1.6; }
    .chantier-section { background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 30px; }
    .chantier-section h3 { font-size: 11px; text-transform: uppercase; color: #92400e; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #1a56db; color: white; }
    thead th { padding: 12px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    thead th:not(:first-child) { text-align: right; }
    tbody tr:hover { background: #f8f9fa; }
    .total-section { margin-left: auto; width: 300px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .total-row.tva { color: #666; }
    .total-row.grand-total { background: #1a56db; color: white; padding: 12px 15px; border-radius: 6px; font-weight: bold; font-size: 14px; margin-top: 5px; }
    .mentions { margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; font-size: 10px; color: #999; line-height: 1.6; }
    .validity { background: #e8f4f8; padding: 10px 15px; border-radius: 6px; margin-bottom: 20px; font-size: 11px; color: #1a56db; }
    .signature-section { display: flex; gap: 40px; margin-top: 40px; }
    .signature-box { flex: 1; border: 1px solid #ddd; padding: 20px; border-radius: 8px; min-height: 100px; }
    .signature-box h4 { font-size: 11px; color: #666; margin-bottom: 10px; }
  </style>
</head>
<body>
<div class="page">

  <!-- EN-TÊTE -->
  <div class="header">
    <div class="company-info">
      <h1>${settings?.company_name || 'Nom Entreprise'}</h1>
      <p>${settings?.company_address || 'Adresse entreprise'}</p>
      <p>📞 ${settings?.company_phone || ''}</p>
      <p>✉️ ${settings?.company_email || ''}</p>
      ${settings?.company_siret ? `<p>SIRET : ${settings.company_siret}</p>` : ''}
    </div>
    <div class="devis-info">
      <div class="numero">DEVIS N° ${numero}</div>
      <div class="date">Date : ${today}</div>
      <div class="date">Validité : ${validite}</div>
    </div>
  </div>

  <!-- PARTIES -->
  <div class="parties">
    <div class="partie">
      <h3>🏢 Prestataire</h3>
      <p><strong>${settings?.company_name || ''}</strong></p>
      <p>${settings?.company_address || ''}</p>
      <p>${settings?.company_phone || ''}</p>
      <p>${settings?.company_email || ''}</p>
    </div>
    <div class="partie">
      <h3>👤 Client</h3>
      <p><strong>${devisData.clientName || ''}</strong></p>
      <p>${devisData.clientAddress || ''}</p>
      <p>${devisData.clientEmail || ''}</p>
    </div>
  </div>

  <!-- CHANTIER -->
  <div class="chantier-section">
    <h3>🏗️ Chantier</h3>
    <p><strong>Adresse :</strong> ${devisData.chantierAddress || ''}</p>
    ${devisData.description ? `<p><strong>Description :</strong> ${devisData.description}</p>` : ''}
    ${devisData.dureeJours ? `<p><strong>Durée estimée :</strong> ${devisData.dureeJours} jour(s)</p>` : ''}
  </div>

  <!-- VALIDITÉ -->
  <div class="validity">
    ℹ️ Ce devis est valable 30 jours à compter du ${today}
  </div>

  <!-- TABLEAU DES PRESTATIONS -->
  <table>
    <thead>
      <tr>
        <th style="width: 50%">Désignation des travaux</th>
        <th style="width: 15%; text-align: right;">Quantité</th>
        <th style="width: 15%; text-align: right;">PU HT</th>
        <th style="width: 20%; text-align: right;">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${lignesHTML}
      ${fraisDeplacement > 0 ? `
      <tr style="background: #fff9e6;">
        <td style="padding: 10px; border-bottom: 1px solid #eee;">🚗 Frais de déplacement (${distanceKm} km × 2 × ${kmRate}€ × ${dureeJours} j)</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">1 forfait</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatEuro(fraisDeplacement)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${formatEuro(fraisDeplacement)}</td>
      </tr>
      ` : ''}
    </tbody>
  </table>

  <!-- TOTAUX -->
  <div class="total-section">
    <div class="total-row">
      <span>Total HT</span>
      <strong>${formatEuro(totalHT)}</strong>
    </div>
    <div class="total-row tva">
      <span>TVA ${tvaRate}%</span>
      <span>${formatEuro(totalTVA)}</span>
    </div>
    <div class="total-row grand-total">
      <span>TOTAL TTC</span>
      <span>${formatEuro(totalTTC)}</span>
    </div>
  </div>

  <!-- SIGNATURES -->
  <div class="signature-section">
    <div class="signature-box">
      <h4>Signature de l'entreprise</h4>
    </div>
    <div class="signature-box">
      <h4>Bon pour accord (client) — Date et signature</h4>
    </div>
  </div>

  <!-- MENTIONS LÉGALES -->
  <div class="mentions">
    <p>Règlement : 30% à la commande, solde à la réception des travaux. Paiement par virement ou chèque.</p>
    <p>En cas de litige, tribunal compétent : ${settings?.company_address?.split(',').pop()?.trim() || 'lieu du siège social'}.</p>
    <p>Taux de pénalité pour retard de paiement : 3 fois le taux d'intérêt légal. Indemnité forfaitaire de recouvrement : 40 €.</p>
    ${settings?.company_siret ? `<p>SIRET : ${settings.company_siret}</p>` : ''}
  </div>

</div>
</body>
</html>`;
}

function generateRentabiliteHTML(devisData, settings) {
  const pricingService = require('./pricingService');
  const totals = pricingService.calculateTotals(devisData);
  const analysis = pricingService.analyzeRentabilite(totals);

  return generateRentabiliteHTMLFromTotals(devisData, totals, analysis, settings);
}

function generateRentabiliteHTMLFromDevis(devis) {
  const totals = {
    totalHT: devis.total_ht,
    totalTVA: devis.total_tva,
    totalTTC: devis.total_ttc,
    totalMaterials: devis.total_materials,
    totalLabor: devis.total_labor,
    totalTravel: devis.total_travel,
    margeBrute: devis.marge_brute,
    tauxMarge: devis.taux_marge,
    coutReel: devis.cout_reel,
    rentabiliteHoraire: devis.rentabilite_horaire
  };

  const pricingService = require('./pricingService');
  const analysis = pricingService.analyzeRentabilite(totals);

  return generateRentabiliteHTMLFromTotals(devis, totals, analysis, null);
}

function generateRentabiliteHTMLFromTotals(devisData, totals, analysis, settings) {
  const couleurNiveau = { bon: '#22c55e', moyen: '#f59e0b', faible: '#ef4444', excellent: '#6366f1' };
  const couleur = couleurNiveau[analysis.niveau] || '#6366f1';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #333; background: white; }
    .page { max-width: 800px; margin: 0 auto; padding: 30px; }
    h1 { color: #dc2626; border-bottom: 3px solid #dc2626; padding-bottom: 10px; margin-bottom: 25px; }
    h2 { color: #1e40af; margin: 25px 0 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
    .warning { background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 15px; margin-bottom: 20px; font-size: 11px; color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    th { background: #1e40af; color: white; padding: 8px 10px; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; }
    .kpi .value { font-size: 20px; font-weight: bold; color: #1e40af; }
    .kpi .label { font-size: 10px; color: #6b7280; margin-top: 5px; text-transform: uppercase; }
    .niveau { display: inline-block; background: ${couleur}; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; font-size: 13px; }
    .recommandations { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px; border-radius: 0 8px 8px 0; }
    .recommandations li { margin: 8px 0; line-height: 1.6; }
    .confidentiel { text-align: center; font-size: 10px; color: #9ca3af; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  </style>
</head>
<body>
<div class="page">
  <div class="warning">⚠️ DOCUMENT CONFIDENTIEL — USAGE INTERNE UNIQUEMENT — NE PAS TRANSMETTRE AU CLIENT</div>

  <h1>📊 FICHE DE RENTABILITÉ INTERNE</h1>
  <p><strong>Chantier :</strong> ${devisData.chantierAddress || devisData.chantier_address || 'N/A'} | <strong>Client :</strong> ${devisData.clientName || devisData.client_name || 'N/A'}</p>

  <h2>1. KPIs Principaux</h2>
  <div class="kpi-grid">
    <div class="kpi">
      <div class="value">${formatEuro(totals.totalHT)}</div>
      <div class="label">CA HT Facturé</div>
    </div>
    <div class="kpi">
      <div class="value">${formatEuro(totals.coutReel)}</div>
      <div class="label">Coût Réel Total</div>
    </div>
    <div class="kpi">
      <div class="value">${formatEuro(totals.margeBrute)}</div>
      <div class="label">Marge Brute</div>
    </div>
    <div class="kpi">
      <div class="value" style="color: ${totals.tauxMarge >= 30 ? '#22c55e' : totals.tauxMarge >= 20 ? '#f59e0b' : '#ef4444'}">${Math.round(totals.tauxMarge)}%</div>
      <div class="label">Taux de Marge</div>
    </div>
    <div class="kpi">
      <div class="value">${formatEuro(totals.rentabiliteHoraire)}/h</div>
      <div class="label">Rentabilité Horaire</div>
    </div>
    <div class="kpi">
      <div class="value">${formatEuro(totals.totalTravel)}</div>
      <div class="label">Frais Déplacement</div>
    </div>
  </div>

  <h2>2. Déboursé Sec Détaillé</h2>
  <table>
    <thead>
      <tr>
        <th>Poste</th>
        <th>Coût Matériaux</th>
        <th>Coût Main d'Œuvre</th>
        <th>Coût Total Réel</th>
        <th>Facturé HT</th>
        <th>Marge</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Matériaux</td>
        <td>${formatEuro(totals.totalMaterials)}</td>
        <td>—</td>
        <td>${formatEuro(totals.totalMaterials)}</td>
        <td>${formatEuro(totals.totalMaterials * (1 + (settings?.margin_material || 30) / 100))}</td>
        <td>${Math.round((settings?.margin_material || 30))}%</td>
      </tr>
      <tr>
        <td>Main d'Œuvre</td>
        <td>—</td>
        <td>${formatEuro(totals.totalLabor)}</td>
        <td>${formatEuro(totals.totalLabor)}</td>
        <td>${formatEuro(totals.totalHT - totals.totalMaterials * (1 + (settings?.margin_material || 30) / 100) - totals.totalTravel)}</td>
        <td>—</td>
      </tr>
      <tr>
        <td>Déplacement</td>
        <td>—</td>
        <td>—</td>
        <td>${formatEuro(totals.totalTravel)}</td>
        <td>${formatEuro(totals.totalTravel)}</td>
        <td>0%</td>
      </tr>
      <tr style="font-weight: bold; background: #dbeafe;">
        <td>TOTAL</td>
        <td>${formatEuro(totals.totalMaterials)}</td>
        <td>${formatEuro(totals.totalLabor)}</td>
        <td>${formatEuro(totals.coutReel)}</td>
        <td>${formatEuro(totals.totalHT)}</td>
        <td>${Math.round(totals.tauxMarge)}%</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Analyse Stratégique</h2>
  <p>Niveau de rentabilité : <span class="niveau">${analysis.niveau.toUpperCase()}</span></p>
  <div class="recommandations" style="margin-top: 15px;">
    <ul style="list-style: none; padding: 0;">
      ${analysis.recommendations.map(r => `<li>${r}</li>`).join('')}
    </ul>
  </div>

  <h2>4. Seuils</h2>
  <table>
    <tr><td>Seuil de rentabilité minimal (marge 0%)</td><td><strong>${formatEuro(totals.coutReel)}</strong></td></tr>
    <tr><td>Seuil rentable (marge 20%)</td><td><strong>${formatEuro(totals.coutReel / 0.8)}</strong></td></tr>
    <tr><td>Seuil idéal (marge 30%)</td><td><strong>${formatEuro(totals.coutReel / 0.7)}</strong></td></tr>
    <tr><td>Prix proposé</td><td><strong>${formatEuro(totals.totalHT)}</strong></td></tr>
  </table>

  <div class="confidentiel">📁 Document généré automatiquement — Confidentiel — Ne pas diffuser</div>
</div>
</body>
</html>`;
}

async function generatePDF(htmlContent) {
  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    });
    await browser.close();
    return pdfBuffer;
  } catch (error) {
    console.error('Erreur Puppeteer, retour HTML buffer:', error.message);
    return Buffer.from(htmlContent, 'utf-8');
  }
}

function formatEuro(val) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val || 0);
}

module.exports = {
  generateDevisHTML,
  generateRentabiliteHTML,
  generateRentabiliteHTMLFromDevis,
  generatePDF
};
