import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generateDevisPdf(devis: any, tenant: any): Promise<Buffer> {
    const html = this.buildDevisHtml(devis, tenant);
    return this.htmlToPdf(html);
  }

  async generateRentabilitePdf(data: any, tenant: any): Promise<Buffer> {
    const html = this.buildRentabiliteHtml(data, tenant);
    return this.htmlToPdf(html);
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    let browser: puppeteer.Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '15mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `<div style="font-size:8px;color:#666;width:100%;text-align:center;padding:0 15mm">
          Page <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>`,
      });
      return Buffer.from(pdf);
    } finally {
      if (browser) await browser.close();
    }
  }

  private formatMontant(n: number | string): string {
    return Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }

  private buildDevisHtml(devis: any, tenant: any): string {
    const lignes = (devis.lignes ?? []).sort((a: any, b: any) => a.ordre - b.ordre);
    const lignesHtml = lignes.map((l: any) => `
      <tr>
        <td>${l.designation}${l.description ? `<br><small style="color:#666">${l.description}</small>` : ''}</td>
        <td style="text-align:center">${l.unite ?? 'u'}</td>
        <td style="text-align:right">${Number(l.quantite).toLocaleString('fr-FR')}</td>
        <td style="text-align:right">${this.formatMontant(l.prixUnitaireHt)}</td>
        <td style="text-align:right">${l.remise > 0 ? l.remise + '%' : '-'}</td>
        <td style="text-align:right"><strong>${this.formatMontant(l.montantHt)}</strong></td>
      </tr>`).join('');

    const dateStr = new Date().toLocaleDateString('fr-FR');
    const validiteStr = devis.dateValidite ? new Date(devis.dateValidite).toLocaleDateString('fr-FR') : 'Non définie';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #333; }
  .header { display: flex; justify-content: space-between; padding: 20px 0 30px; border-bottom: 3px solid #2563eb; }
  .company h1 { font-size: 20px; color: #2563eb; }
  .company p { color: #666; margin-top: 4px; }
  .devis-info { text-align: right; }
  .devis-info h2 { font-size: 24px; color: #2563eb; }
  .devis-info .numero { font-size: 14px; font-weight: bold; }
  .parties { display: flex; gap: 20px; margin: 20px 0; }
  .partie { flex: 1; padding: 12px; background: #f8fafc; border-radius: 6px; }
  .partie h3 { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 8px; letter-spacing: 1px; }
  .partie p { line-height: 1.6; }
  .description { padding: 12px; background: #eff6ff; border-left: 4px solid #2563eb; margin: 15px 0; border-radius: 0 6px 6px 0; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  thead th { background: #2563eb; color: white; padding: 8px; text-align: left; font-size: 10px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .totals { margin-left: auto; width: 280px; margin-top: 15px; }
  .totals table { font-size: 11px; }
  .totals td { padding: 5px 8px; }
  .totals .total-ttc { background: #2563eb; color: white; font-weight: bold; font-size: 13px; }
  .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #666; }
  .acompte-box { background: #fefce8; border: 1px solid #fbbf24; padding: 10px; border-radius: 6px; margin: 15px 0; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: bold; }
  .badge-brouillon { background: #e2e8f0; color: #475569; }
  .badge-envoye { background: #dbeafe; color: #1d4ed8; }
  .badge-accepte { background: #dcfce7; color: #15803d; }
</style>
</head>
<body>
<div class="header">
  <div class="company">
    <h1>${tenant.companyName ?? 'Mon Entreprise'}</h1>
    <p>${tenant.address ?? ''}</p>
    <p>${tenant.phone ?? ''} — ${tenant.email ?? ''}</p>
    <p>SIRET: ${tenant.siret ?? ''}</p>
    ${tenant.tvaNumber ? `<p>N° TVA: ${tenant.tvaNumber}</p>` : ''}
  </div>
  <div class="devis-info">
    <h2>DEVIS</h2>
    <div class="numero">${devis.numero}</div>
    <p style="margin-top:8px">Date: ${dateStr}</p>
    <p>Validité: ${validiteStr}</p>
    <span class="badge badge-${devis.statut}">${devis.statut.toUpperCase()}</span>
  </div>
</div>

<div class="parties">
  <div class="partie">
    <h3>Émetteur</h3>
    <p><strong>${tenant.companyName ?? ''}</strong></p>
    <p>${tenant.address ?? ''}</p>
  </div>
  <div class="partie">
    <h3>Client</h3>
    <p><strong>${devis.clientName}</strong></p>
    ${devis.clientAddress ? `<p>${devis.clientAddress}</p>` : ''}
    ${devis.clientEmail ? `<p>${devis.clientEmail}</p>` : ''}
    ${devis.clientPhone ? `<p>${devis.clientPhone}</p>` : ''}
  </div>
</div>

<div class="description">
  <strong>Objet des travaux :</strong> ${devis.description}
  ${devis.dureeJours ? `<br><strong>Durée estimée :</strong> ${devis.dureeJours} jour(s) ouvré(s)` : ''}
</div>

<table>
  <thead>
    <tr>
      <th style="width:40%">Désignation</th>
      <th style="width:8%;text-align:center">Unité</th>
      <th style="width:8%;text-align:right">Qté</th>
      <th style="width:14%;text-align:right">PU HT</th>
      <th style="width:8%;text-align:right">Remise</th>
      <th style="width:14%;text-align:right">Total HT</th>
    </tr>
  </thead>
  <tbody>${lignesHtml}</tbody>
</table>

<div class="totals">
  <table>
    <tr><td>Total HT</td><td style="text-align:right">${this.formatMontant(devis.montantHt)}</td></tr>
    ${Number(devis.remiseGlobale) > 0 ? `<tr><td>Remise globale (${devis.remiseGlobale}%)</td><td style="text-align:right">-${this.formatMontant(Number(devis.montantHt) * Number(devis.remiseGlobale) / 100)}</td></tr>` : ''}
    <tr><td>TVA (${devis.tvaRate}%)</td><td style="text-align:right">${this.formatMontant(devis.montantTva)}</td></tr>
    <tr class="total-ttc"><td><strong>TOTAL TTC</strong></td><td style="text-align:right"><strong>${this.formatMontant(devis.montantTtc)}</strong></td></tr>
  </table>
</div>

${devis.acomptePercent > 0 ? `
<div class="acompte-box">
  <strong>Acompte à la commande (${devis.acomptePercent}%) :</strong> ${this.formatMontant(Number(devis.montantTtc) * Number(devis.acomptePercent) / 100)}
</div>` : ''}

${devis.conditionsPaiement ? `<p style="margin-top:10px"><strong>Conditions de paiement :</strong> ${devis.conditionsPaiement}</p>` : ''}

${devis.notesInternes ? `<div style="margin-top:15px;padding:10px;background:#f1f5f9;border-radius:6px"><strong>Notes :</strong> ${devis.notesInternes}</div>` : ''}

<div class="footer">
  <p>Ce devis est valable jusqu'au ${validiteStr}. Merci de le retourner signé avec la mention "Bon pour accord".</p>
  <p style="margin-top:5px">Artisan soumis au régime de la TVA — ${tenant.insuranceInfo ?? 'Assuré RC Pro'}</p>
</div>
</body>
</html>`;
  }

  private buildRentabiliteHtml(data: any, tenant: any): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
  h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 15px; margin: 20px 0; }
  .kpi { background: #f8fafc; border-radius: 8px; padding: 15px; text-align: center; border-top: 4px solid #2563eb; }
  .kpi .value { font-size: 22px; font-weight: bold; color: #2563eb; }
  .kpi .label { font-size: 10px; color: #666; margin-top: 4px; }
  .section { margin: 20px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #2563eb; color: white; padding: 8px; text-align: left; }
  td { padding: 7px; border-bottom: 1px solid #e2e8f0; }
</style>
</head>
<body>
<h1>Analyse de Rentabilité — ${data.devisNumero ?? ''}</h1>
<p style="color:#666">Généré le ${new Date().toLocaleDateString('fr-FR')} par ${tenant.companyName ?? ''}</p>

<div class="kpi-grid">
  <div class="kpi">
    <div class="value">${Number(data.totalHt ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
    <div class="label">Chiffre d'affaires HT</div>
  </div>
  <div class="kpi">
    <div class="value" style="color:${data.tauxMarge > 25 ? '#15803d' : '#dc2626'}">${data.tauxMarge ?? 0}%</div>
    <div class="label">Taux de marge matériaux</div>
  </div>
  <div class="kpi">
    <div class="value">${data.dureeJours ?? 0} j</div>
    <div class="label">Durée chantier</div>
  </div>
</div>

<div class="section">
<table>
  <tr><th>Indicateur</th><th>Montant</th></tr>
  <tr><td>Main d'œuvre</td><td>${Number(data.mainOeuvre ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td></tr>
  <tr><td>Matériaux (prix vente)</td><td>${Number(data.materiaux ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td></tr>
  <tr><td>Matériaux (prix achat)</td><td>${Number(data.prixAchats ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td></tr>
  <tr style="font-weight:bold"><td>Marge matériaux</td><td style="color:${data.margeMateriaux > 0 ? '#15803d' : '#dc2626'}">${Number(data.margeMateriaux ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td></tr>
  <tr><td>TJM moyen</td><td>${Number(data.tauxJournalier ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}/j</td></tr>
</table>
</div>
</body>
</html>`;
  }
}
