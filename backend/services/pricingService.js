// Service de calcul des prix et marges

function calculateTotals(devisData) {
  const settings = require('../database/db').prepare('SELECT * FROM settings WHERE id = 1').get();
  const tvaRate = (settings?.tva_rate || devisData.tvaRate || 10) / 100;

  let totalMaterials = 0;
  let totalLabor = 0;
  let totalCoutReel = 0;
  let totalHeures = 0;

  const lignes = devisData.lignes || [];

  lignes.forEach(ligne => {
    const totalLigne = (ligne.quantite || 0) * (ligne.prixUnitaireHT || 0);
    totalMaterials += ligne.coutMateriau ? ligne.coutMateriau * (ligne.quantite || 1) : 0;
    totalLabor += ligne.coutMainOeuvre ? ligne.coutMainOeuvre * (ligne.quantite || 1) : 0;
    totalCoutReel += (ligne.coutMateriau || 0) * (ligne.quantite || 1) + (ligne.coutMainOeuvre || 0) * (ligne.quantite || 1);
    totalHeures += (ligne.heuresMO || 0) * (ligne.quantite || 1);
  });

  // Frais de déplacement
  const distanceKm = parseFloat(devisData.distanceKm || 0);
  const dureeJours = parseInt(devisData.dureeJours || 1);
  const kmRate = settings?.km_rate || 0.30;
  const totalTravel = distanceKm * 2 * kmRate * dureeJours; // aller-retour × jours

  // Total HT facturé
  const totalHT = lignes.reduce((sum, l) => sum + (l.quantite || 0) * (l.prixUnitaireHT || 0), 0) + totalTravel;

  // Coût réel total
  totalCoutReel += totalTravel; // inclure le déplacement dans le coût réel

  // Marges
  const margeBrute = totalHT - totalCoutReel;
  const tauxMarge = totalHT > 0 ? (margeBrute / totalHT) * 100 : 0;
  const rentabiliteHoraire = totalHeures > 0 ? margeBrute / totalHeures : 0;

  // TVA
  const totalTVA = totalHT * tvaRate;
  const totalTTC = totalHT + totalTVA;

  return {
    totalHT: round(totalHT),
    totalTVA: round(totalTVA),
    totalTTC: round(totalTTC),
    totalMaterials: round(totalMaterials),
    totalLabor: round(totalLabor),
    totalTravel: round(totalTravel),
    margeBrute: round(margeBrute),
    tauxMarge: round(tauxMarge),
    coutReel: round(totalCoutReel),
    rentabiliteHoraire: round(rentabiliteHoraire),
    totalHeures: round(totalHeures)
  };
}

function calculateDistanceCost(distanceKm, dureeJours, kmRate = 0.30) {
  return distanceKm * 2 * kmRate * dureeJours;
}

function applyMaterialMargin(coutFournisseur, marginPercent = 30) {
  return coutFournisseur * (1 + marginPercent / 100);
}

function estimateLaborCost(heures, tauxHoraire = 15) {
  return heures * tauxHoraire;
}

function analyzeRentabilite(totals) {
  const recommendations = [];
  let niveau = 'bon';

  if (totals.tauxMarge < 20) {
    niveau = 'faible';
    recommendations.push('⚠️ Marge insuffisante (< 20%). Risque de perte sur imprévus.');
    recommendations.push('→ Augmenter les prix de 10-15% ou réduire le coût matériaux.');
  } else if (totals.tauxMarge < 30) {
    niveau = 'moyen';
    recommendations.push('⚡ Marge correcte mais perfectible (20-30%).');
    recommendations.push('→ Optimiser les postes matériaux pour gagner 5-8% de marge.');
  } else if (totals.tauxMarge >= 30) {
    niveau = 'excellent';
    recommendations.push('✅ Excellente marge (> 30%). Chantier très rentable.');
  }

  if (totals.totalTravel > totals.totalHT * 0.1) {
    recommendations.push('🚗 Frais de déplacement élevés (> 10% du CA). Regrouper les chantiers de la zone.');
  }

  if (totals.rentabiliteHoraire < 20) {
    recommendations.push('⏱️ Rentabilité horaire faible. Revoir le temps estimé ou augmenter les prix.');
  }

  return { niveau, recommendations };
}

function round(val) {
  return Math.round(val * 100) / 100;
}

module.exports = {
  calculateTotals,
  calculateDistanceCost,
  applyMaterialMargin,
  estimateLaborCost,
  analyzeRentabilite
};
