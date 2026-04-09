const path = require('path');
const fs = require('fs');

function generateDevisHTML(devisData, settings, numero) {
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const validite = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const lignes = devisData.lignes || [];
  const tvaRate = settings?.tva_rate ?? 10;
  const kmRate  = settings?.km_rate  ?? 0.30;

  let totalHT = 0;
  const lignesHTML = lignes.map((ligne, idx) => {
    const pu    = ligne.prixUnitaireHT || ligne.prix_unitaire_ht || ligne.prix_unitaire || 0;
    const qte   = ligne.quantite || 0;
    const total = qte * pu;
    totalHT += total;
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8faff';
    return `
      <tr style="background:${bg}">
        <td style="padding:11px 14px;border-bottom:1px solid #e8edf5;font-size:12px">${ligne.designation || ''}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #e8edf5;text-align:center;font-size:12px;color:#555">${qte} <span style="color:#999;font-size:11px">${ligne.unite || 'u'}</span></td>
        <td style="padding:11px 14px;border-bottom:1px solid #e8edf5;text-align:right;font-size:12px">${formatEuro(pu)}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #e8edf5;text-align:right;font-weight:700;font-size:12px;color:#1a3a6b">${formatEuro(total)}</td>
      </tr>`;
  }).join('');

  const distanceKm     = parseFloat(devisData.distanceKm || devisData.distance_km || 0);
  const dureeJours     = parseInt(devisData.dureeJours   || devisData.duree_jours  || 1);
  const fraisDeplacement = distanceKm * 2 * kmRate * dureeJours;
  if (fraisDeplacement > 0) totalHT += fraisDeplacement;

  const totalTVA = totalHT * tvaRate / 100;
  const totalTTC = totalHT + totalTVA;

  const clientName    = devisData.clientName    || devisData.client_name    || '';
  const clientAddress = devisData.clientAddress || devisData.client_address || '';
  const clientEmail   = devisData.clientEmail   || devisData.client_email   || '';
  const chantierAddr  = devisData.chantierAddress || devisData.chantier_address || '';
  const description   = devisData.description   || devisData.chantier_description || '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',Arial,sans-serif;font-size:13px;color:#1a1a2e;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{max-width:820px;margin:0 auto;padding:0}

    /* BANDE COULEUR HAUT */
    .top-bar{background:linear-gradient(135deg,#1a3a6b 0%,#1a56db 100%);height:8px}

    /* HEADER */
    .header{display:flex;justify-content:space-between;align-items:flex-start;padding:32px 40px 24px;border-bottom:1px solid #e8edf5}
    .company-name{font-size:22px;font-weight:700;color:#1a3a6b;letter-spacing:-0.5px;margin-bottom:6px}
    .company-details{font-size:11.5px;color:#6b7280;line-height:1.8}
    .devis-badge{text-align:right}
    .devis-badge .label{font-size:10px;font-weight:600;color:#1a56db;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px}
    .devis-numero{font-size:24px;font-weight:800;color:#1a3a6b;letter-spacing:-0.5px}
    .devis-dates{font-size:11px;color:#6b7280;margin-top:6px;line-height:1.8}
    .devis-dates strong{color:#374151}

    /* PARTIES */
    .parties{display:flex;gap:0;margin:0;border-bottom:1px solid #e8edf5}
    .partie{flex:1;padding:20px 40px;background:#f8faff}
    .partie:first-child{border-right:1px solid #e8edf5}
    .partie-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a56db;margin-bottom:10px}
    .partie-name{font-size:14px;font-weight:700;color:#1a3a6b;margin-bottom:4px}
    .partie-detail{font-size:11.5px;color:#6b7280;line-height:1.7}

    /* CHANTIER */
    .chantier{background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 40px;display:flex;align-items:center;gap:16px;font-size:12px}
    .chantier-icon{font-size:18px}
    .chantier-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#92400e;margin-bottom:2px}
    .chantier-value{font-weight:600;color:#1a1a2e}
    .chantier-desc{color:#6b7280;font-size:11.5px;margin-top:2px}

    /* VALIDITE */
    .validity-bar{background:#eff6ff;border-bottom:1px solid #dbeafe;padding:10px 40px;font-size:11.5px;color:#1d4ed8;display:flex;align-items:center;gap:8px}

    /* TABLEAU */
    .table-section{padding:24px 40px 0}
    .table-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;border:1px solid #e8edf5;border-radius:8px;overflow:hidden}
    thead tr{background:linear-gradient(135deg,#1a3a6b,#1a56db)}
    thead th{padding:12px 14px;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:rgba(255,255,255,0.9)}
    thead th:first-child{text-align:left}
    thead th:not(:first-child){text-align:right}
    tfoot td{padding:10px 14px;font-size:11.5px;background:#f0f4ff;border-top:2px solid #dbeafe}

    /* TOTAUX */
    .totaux{display:flex;justify-content:flex-end;padding:20px 40px 0}
    .totaux-box{width:300px;border:1px solid #e8edf5;border-radius:10px;overflow:hidden}
    .total-row{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px}
    .total-row:last-child{border-bottom:none}
    .total-row.ht{background:#f8faff;color:#374151}
    .total-row.tva-row{background:#fff;color:#6b7280;font-size:12px}
    .total-row.ttc{background:linear-gradient(135deg,#1a3a6b,#1a56db);color:#fff;font-weight:700;font-size:15px;padding:14px 16px}

    /* SIGNATURES */
    .signatures{display:flex;gap:24px;padding:32px 40px 0}
    .sig-box{flex:1;border:1px solid #e8edf5;border-radius:10px;padding:20px;min-height:110px;position:relative}
    .sig-label{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#6b7280;margin-bottom:8px}
    .sig-hint{font-size:10px;color:#9ca3af;margin-top:12px}
    .sig-box.client{border-color:#1a56db;border-style:dashed}
    .sig-bpa{font-size:11px;font-weight:700;color:#1a56db;margin-bottom:4px}

    /* MENTIONS */
    .mentions{padding:24px 40px;margin-top:8px;border-top:1px solid #f3f4f6;font-size:10px;color:#9ca3af;line-height:1.8}
    .mentions strong{color:#6b7280}

    /* PIED */
    .footer{background:#f8faff;border-top:1px solid #e8edf5;padding:12px 40px;display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:#9ca3af}
    .bottom-bar{background:linear-gradient(135deg,#1a3a6b 0%,#1a56db 100%);height:4px}

    @media print{.page{max-width:100%}}
  </style>
</head>
<body>
<div class="page">
  <div class="top-bar"></div>

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="company-name">${settings?.company_name || 'Mon Entreprise BTP'}</div>
      <div class="company-details">
        ${settings?.company_address ? settings.company_address + '<br>' : ''}
        ${settings?.company_phone   ? '&#128222; ' + settings.company_phone + '&nbsp;&nbsp;' : ''}
        ${settings?.company_email   ? '&#9993; '  + settings.company_email : ''}
        ${settings?.company_siret   ? '<br>SIRET : ' + settings.company_siret : ''}
      </div>
    </div>
    <div class="devis-badge">
      <div class="label">Devis</div>
      <div class="devis-numero">N° ${numero}</div>
      <div class="devis-dates">
        <strong>Émis le :</strong> ${today}<br>
        <strong>Valable jusqu'au :</strong> ${validite}
      </div>
    </div>
  </div>

  <!-- PARTIES -->
  <div class="parties">
    <div class="partie">
      <div class="partie-label">Prestataire</div>
      <div class="partie-name">${settings?.company_name || ''}</div>
      <div class="partie-detail">${settings?.company_address || ''}</div>
    </div>
    <div class="partie">
      <div class="partie-label">Client</div>
      <div class="partie-name">${clientName}</div>
      <div class="partie-detail">
        ${clientAddress ? clientAddress + '<br>' : ''}
        ${clientEmail   ? clientEmail : ''}
      </div>
    </div>
  </div>

  <!-- CHANTIER -->
  <div class="chantier">
    <div class="chantier-icon">&#127959;</div>
    <div>
      <div class="chantier-label">Adresse du chantier</div>
      <div class="chantier-value">${chantierAddr || 'À préciser'}</div>
      ${description ? `<div class="chantier-desc">${description}</div>` : ''}
    </div>
    ${dureeJours ? `<div style="margin-left:auto;text-align:right"><div class="chantier-label">Durée estimée</div><div class="chantier-value">${dureeJours} jour${dureeJours > 1 ? 's' : ''}</div></div>` : ''}
  </div>

  <!-- BARRE VALIDITÉ -->
  <div class="validity-bar">
    &#8505;&#65039;&nbsp; Ce devis est valable 30 jours — jusqu'au <strong style="margin-left:4px">${validite}</strong>
  </div>

  <!-- TABLEAU -->
  <div class="table-section">
    <div class="table-title">Détail des prestations</div>
    <table>
      <thead>
        <tr>
          <th style="width:50%;text-align:left">Désignation des travaux</th>
          <th style="width:13%">Quantité</th>
          <th style="width:17%">Prix unit. HT</th>
          <th style="width:20%">Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${lignesHTML}
        ${fraisDeplacement > 0 ? `
        <tr style="background:#fffbeb">
          <td style="padding:11px 14px;border-bottom:1px solid #e8edf5;font-size:12px;color:#92400e">
            &#128663; Frais de déplacement <span style="font-size:10.5px;color:#b45309">(${distanceKm} km A/R × ${kmRate} €/km × ${dureeJours} j)</span>
          </td>
          <td style="padding:11px 14px;border-bottom:1px solid #e8edf5;text-align:center;font-size:12px">1 forfait</td>
          <td style="padding:11px 14px;border-bottom:1px solid #e8edf5;text-align:right;font-size:12px">${formatEuro(fraisDeplacement)}</td>
          <td style="padding:11px 14px;border-bottom:1px solid #e8edf5;text-align:right;font-weight:700;font-size:12px;color:#92400e">${formatEuro(fraisDeplacement)}</td>
        </tr>` : ''}
      </tbody>
    </table>
  </div>

  <!-- TOTAUX -->
  <div class="totaux">
    <div class="totaux-box">
      <div class="total-row ht">
        <span>Total HT</span>
        <strong>${formatEuro(totalHT)}</strong>
      </div>
      <div class="total-row tva-row">
        <span>TVA ${tvaRate}%</span>
        <span>${formatEuro(totalTVA)}</span>
      </div>
      <div class="total-row ttc">
        <span>TOTAL TTC</span>
        <span>${formatEuro(totalTTC)}</span>
      </div>
    </div>
  </div>

  <!-- SIGNATURES -->
  <div class="signatures">
    <div class="sig-box">
      <div class="sig-label">Signature de l'entreprise</div>
      <div class="sig-hint">Cachet + signature</div>
    </div>
    <div class="sig-box client">
      <div class="sig-bpa">Bon pour accord</div>
      <div class="sig-label">Signature du client</div>
      <div class="sig-hint">Date, mention « Bon pour accord » + signature</div>
    </div>
  </div>

  <!-- MENTIONS -->
  <div class="mentions">
    <strong>Conditions de règlement :</strong> 30 % d'acompte à la commande, solde à réception des travaux. Virement bancaire ou chèque.<br>
    <strong>Pénalités de retard :</strong> Tout retard de paiement entraîne une pénalité égale à 3 fois le taux d'intérêt légal en vigueur, avec une indemnité forfaitaire de recouvrement de 40 €.<br>
    <strong>Garanties :</strong> Garantie décennale et garantie biennale applicables conformément à la réglementation en vigueur.
    ${settings?.company_siret ? `<br><strong>SIRET :</strong> ${settings.company_siret}` : ''}
  </div>

  <!-- PIED DE PAGE -->
  <div class="footer">
    <span>${settings?.company_name || ''} — Devis N° ${numero}</span>
    <span>Document généré le ${today}</span>
  </div>
  <div class="bottom-bar"></div>
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
