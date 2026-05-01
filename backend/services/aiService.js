require('dotenv').config();
const db = require('../database/db');

// =============================================
//  MODE DÉMO — Fonctionne sans clé API
// =============================================

const DEMO_RESPONSES = {
  default: (msg) => `Bonjour ! Je suis votre expert BTP en **mode démo** (aucune clé API configurée).

Pour activer l'IA complète, ajoutez votre clé Anthropic dans **Paramètres**.

En attendant, voici comment je peux vous aider :
- Décrivez votre projet (ex: "salle de bain 8m² à Reims")
- Uploadez des plans ou photos
- Je génère un devis structuré avec liste de courses

---

💡 **Vous avez écrit :** "${msg?.substring(0, 100) || '...'}"

Pour tester l'application, utilisez le bouton **"Nouveau Devis"** dans le menu de gauche et remplissez le formulaire de saisie manuelle.`,

  salleDeBain: (surface) => `## ⚠️ POINTS D'ATTENTION CHANTIER

- **Amiante** : Si construction avant 1997, diagnostic obligatoire avant dépose carrelage
- **Humidité** : Vérifier étanchéité des murs (surtout douche) — risque de moisissures cachées
- **Canalisations** : Repérer arrivées/évacuations encastrées avant tout perçage
- **Planéité sol** : Vérifier avec règle de 2m — ragréage probable si écart > 3mm
- **Accès chantier** : Prévoir protection escalier et évacuation gravats (benne si >1 tonne)
- **Électricité** : Coupure circuit humide obligatoire, vérifier norme NF C 15-100

---

## 📄 DEVIS CLIENT — Rénovation Salle de Bain ${surface}m²

| Désignation | Qté | Unité | PU HT | Total HT |
|---|---|---|---|---|
| Dépose carrelage sol existant | ${surface} | m² | 18,00 € | ${(surface * 18).toFixed(2)} € |
| Dépose carrelage mural existant | ${surface * 2.5} | m² | 15,00 € | ${(surface * 2.5 * 15).toFixed(2)} € |
| Évacuation gravats (benne 5m³) | 1 | Forfait | 220,00 € | 220,00 € |
| Ragréage sol autonivelant | ${surface} | m² | 22,00 € | ${(surface * 22).toFixed(2)} € |
| Fourniture carrelage sol grès cérame 60×60 | ${Math.ceil(surface * 1.1)} | m² | 32,00 € | ${(Math.ceil(surface * 1.1) * 32).toFixed(2)} € |
| Pose carrelage sol | ${surface} | m² | 42,00 € | ${(surface * 42).toFixed(2)} € |
| Colle carrelage C2 (sacs 25kg) | ${Math.ceil(surface / 4)} | sac | 24,00 € | ${(Math.ceil(surface / 4) * 24).toFixed(2)} € |
| Joint époxy pour sol | ${surface} | m² | 8,00 € | ${(surface * 8).toFixed(2)} € |
| Fourniture faïence murale 30×60 | ${Math.ceil(surface * 2.5 * 1.1)} | m² | 28,00 € | ${(Math.ceil(surface * 2.5 * 1.1) * 28).toFixed(2)} € |
| Pose faïence murale | ${surface * 2.5} | m² | 48,00 € | ${(surface * 2.5 * 48).toFixed(2)} € |
| Colle carrelage mural C1 (sacs 25kg) | ${Math.ceil(surface * 2.5 / 5)} | sac | 18,00 € | ${(Math.ceil(surface * 2.5 / 5) * 18).toFixed(2)} € |
| Joint mural (sacs 5kg) | ${Math.ceil(surface * 2.5 / 10)} | sac | 22,00 € | ${(Math.ceil(surface * 2.5 / 10) * 22).toFixed(2)} € |
| Silicone sanitaire (cartouche) | 3 | unité | 8,00 € | 24,00 € |
| Profilés d'angle inox | ${Math.ceil(surface * 0.8)} | ml | 4,50 € | ${(Math.ceil(surface * 0.8) * 4.50).toFixed(2)} € |
| Fourniture receveur douche 90×90 | 1 | unité | 320,00 € | 320,00 € |
| Fourniture paroi douche verre 8mm | 1 | unité | 450,00 € | 450,00 € |
| Fourniture lavabo encastré + robinetterie | 1 | Forfait | 380,00 € | 380,00 € |
| Fourniture WC suspendu + bâti | 1 | unité | 480,00 € | 480,00 € |
| Plomberie — dépose sanitaires | 1 | Forfait | 280,00 € | 280,00 € |
| Plomberie — pose sanitaires + raccordements | 1 | Forfait | 680,00 € | 680,00 € |
| Fourniture robinetterie douche | 1 | unité | 180,00 € | 180,00 € |
| Peinture plafond (2 couches + primaire) | ${surface} | m² | 22,00 € | ${(surface * 22).toFixed(2)} € |
| Visserie, chevilles, consommables | 1 | Forfait | 45,00 € | 45,00 € |
| Bâches protection chantier | 1 | Forfait | 30,00 € | 30,00 € |
| Nettoyage fin de chantier | 1 | Forfait | 180,00 € | 180,00 € |

**Durée estimée : 4j dépose+carrelage + 2j plomberie + 1j peinture = 7j × 1,15 contingence = 9 jours**
**Total HT :** cf. tableau
**TVA 10%**
**Total TTC :** cf. tableau

---

## 📊 FICHE DE RENTABILITÉ (INTERNE)

| Poste | Coût réel | Facturé | Marge |
|---|---|---|---|
| Carrelage sol (matière) | ${(surface * 1.1 * 14).toFixed(2)} € | ${(Math.ceil(surface * 1.1) * 32).toFixed(2)} € | ${Math.round((1 - 14/32) * 100)}% |
| Carrelage mural (matière) | ${(surface * 2.5 * 1.1 * 12).toFixed(2)} € | ${(Math.ceil(surface * 2.5 * 1.1) * 28).toFixed(2)} € | ${Math.round((1 - 12/28) * 100)}% |
| Sanitaires | 1 100,00 € | 1 810,00 € | 39% |
| MO totale | ${(9 * 8 * 15).toFixed(2)} € | — | — |

**Taux de marge global estimé : ~34%** ✅

---

## 🛒 LISTE DE COURSES FOURNISSEURS

| Fourniture | Qté | Prix marché | Fournisseur conseillé | Total |
|---|---|---|---|---|
| Carrelage grès cérame 60×60 | ${Math.ceil(surface * 1.1)} m² | 14-22 €/m² | Brico Dépôt / Carrelages du Midi | ${(Math.ceil(surface * 1.1) * 18).toFixed(2)} € |
| Faïence murale 30×60 | ${Math.ceil(surface * 2.5 * 1.1)} m² | 12-20 €/m² | Leroy Merlin / Point P | ${(Math.ceil(surface * 2.5 * 1.1) * 15).toFixed(2)} € |
| Colle C2 (25kg) | ${Math.ceil(surface / 4)} sacs | 16-20 € | Point P / Bigmat | ${(Math.ceil(surface / 4) * 17).toFixed(2)} € |
| Receveur douche 90×90 | 1 | 180-320 € | Brico Dépôt / Cedeo | 200,00 € |
| WC suspendu + bâti | 1 | 280-420 € | Cedeo / Sanitaire Pro | 310,00 € |
| Robinetterie douche | 1 | 80-160 € | Cedeo / Leroy Merlin | 90,00 € |
| Silicone sanitaire | 3 cart. | 4-7 € | Tout fournisseur | 14,00 € |
| Profilés inox | ${Math.ceil(surface * 0.8)} ml | 2-4 €/ml | Leroy Merlin | ${(Math.ceil(surface * 0.8) * 3).toFixed(2)} € |

---

## 📈 ANALYSE STRATÉGIQUE

✅ **Chantier rentable** — Marge ~34%, dans la cible artisan
⚡ **Optimisation** — Négocier carrelage en lot (>30m²) : -8-12% chez Point P
📍 **Risque principal** — Humidité cachée peut nécessiter 1-2j supplémentaires (+contingence déjà incluse)
💡 **Option upsell** — Proposer niche de douche encastrée (+250€ HT, marge 45%)`,

  carrelage: (surface) => `## ⚠️ POINTS D'ATTENTION CHANTIER

- **Planéité support** : Tolérance max 3mm/2m — ragréage systématique à prévoir
- **Nature du support** : Parquet ? Chape ? Béton ? Vérifier adhérence colle
- **Chauffage plancher** : Désactiver 48h avant + colle flexible C2S1 obligatoire
- **Chutes** : Prévoir 10-12% de surplus pour coupes

---

## 📄 DEVIS CLIENT — Pose Carrelage ${surface}m²

| Désignation | Qté | Unité | PU HT | Total HT |
|---|---|---|---|---|
| Dépose ancien revêtement | ${surface} | m² | 14,00 € | ${(surface * 14).toFixed(2)} € |
| Évacuation déchets | 1 | Forfait | 120,00 € | 120,00 € |
| Ragréage sol (sacs 25kg) | ${Math.ceil(surface / 6)} | sac | 28,00 € | ${(Math.ceil(surface / 6) * 28).toFixed(2)} € |
| Primaire d'accrochage | ${surface} | m² | 4,50 € | ${(surface * 4.50).toFixed(2)} € |
| Fourniture carrelage 60×60 grès cérame | ${Math.ceil(surface * 1.1)} | m² | 28,00 € | ${(Math.ceil(surface * 1.1) * 28).toFixed(2)} € |
| Colle carrelage C2 flexible | ${Math.ceil(surface / 4)} | sac | 26,00 € | ${(Math.ceil(surface / 4) * 26).toFixed(2)} € |
| Pose carrelage (y.c. découpes) | ${surface} | m² | 38,00 € | ${(surface * 38).toFixed(2)} € |
| Joint époxy (sacs 5kg) | ${Math.ceil(surface / 12)} | sac | 42,00 € | ${(Math.ceil(surface / 12) * 42).toFixed(2)} € |
| Plinthes carrelage assorties | ${Math.ceil(Math.sqrt(surface) * 4)} | ml | 9,50 € | ${(Math.ceil(Math.sqrt(surface) * 4) * 9.50).toFixed(2)} € |
| Profilés de transition | 2 | ml | 12,00 € | 24,00 € |
| Nettoyage acide + protection | ${surface} | m² | 4,00 € | ${(surface * 4).toFixed(2)} € |
| Bâches protection chantier | 1 | Forfait | 25,00 € | 25,00 € |
| Visserie, consommables | 1 | Forfait | 35,00 € | 35,00 € |

**Durée estimée : 1j préparation + ${Math.ceil(surface / 15)}j pose = ${1 + Math.ceil(surface / 15)}j × 1,15 = ${Math.ceil((1 + Math.ceil(surface / 15)) * 1.15)} jours**

---

## 🛒 LISTE DE COURSES FOURNISSEURS

| Fourniture | Qté | Prix marché | Fournisseur conseillé | Total |
|---|---|---|---|---|
| Carrelage 60×60 | ${Math.ceil(surface * 1.1)} m² | 14-25 €/m² | Brico Dépôt / Point P | ${(Math.ceil(surface * 1.1) * 18).toFixed(2)} € |
| Ragréage (25kg) | ${Math.ceil(surface / 6)} sacs | 18-28 € | Bigmat / Socoda | ${(Math.ceil(surface / 6) * 20).toFixed(2)} € |
| Colle C2 flexible (25kg) | ${Math.ceil(surface / 4)} sacs | 18-26 € | Point P / Bigmat | ${(Math.ceil(surface / 4) * 20).toFixed(2)} € |
| Joint époxy (5kg) | ${Math.ceil(surface / 12)} sacs | 35-50 € | Leroy Merlin / Pro | ${(Math.ceil(surface / 12) * 38).toFixed(2)} € |

**Marge estimée : ~36%** ✅`,

  plomberie: (msg) => `## ⚠️ POINTS D'ATTENTION CHANTIER

- **Coupure d'eau** : Localiser vanne générale + prévoir coupure pendant l'intervention
- **Compatibilité** : Vérifier pression réseau (1,5-3 bar requis pour la plupart des équipements)
- **Accès** : Dégager la zone d'installation (compteur, cellier, local technique)
- **Évacuation** : Prévoir raccordement sur siphon ou évacuation existante si nécessaire
- **Garantie** : Installation conforme aux prescriptions fabricant (obligatoire pour SAV)
- **DTU 60.1** : Respecter les normes d'installation plomberie en vigueur

---

## 📄 DEVIS CLIENT — Installation / Plomberie

| Désignation | Qté | Unité | PU HT | Total HT |
|---|---|---|---|---|
| Fourniture équipement principal (selon devis fabricant) | 1 | u | 580,00 € | 580,00 € |
| Fourniture robinetterie et vannes d'arrêt | 4 | u | 28,00 € | 112,00 € |
| Fourniture raccords à sertir (lot) | 1 | Forfait | 65,00 € | 65,00 € |
| Tuyaux multicouche Ø16 ou Ø20 | 3 | ml | 8,50 € | 25,50 € |
| Coudes, tés, jonctions (lot) | 1 | Forfait | 45,00 € | 45,00 € |
| Fourniture filtre anti-particules | 1 | u | 38,00 € | 38,00 € |
| Pose et raccordement équipement | 1 | Forfait | 280,00 € | 280,00 € |
| Test d'étanchéité + mise en service | 1 | Forfait | 80,00 € | 80,00 € |
| Protection sol et évacuation déchets emballages | 1 | Forfait | 25,00 € | 25,00 € |

**Durée estimée : 1j installation × 1,15 contingence = 1 journée**
**Total HT : ~1 250,50 €**
**TVA 10% : ~125,05 €**
**Total TTC : ~1 375,55 €**

---

## 📊 FICHE DE RENTABILITÉ (INTERNE)

| Poste | Coût réel | Facturé | Marge |
|---|---|---|---|
| Équipement + fournitures | 580,00 € | 930,50 € | 37% |
| Main d'œuvre (6h × 15€) | 90,00 € | 360,00 € | 75% |

**Taux de marge global estimé : ~38%** ✅

---

## 🛒 LISTE DE COURSES FOURNISSEURS

| Fourniture | Qté | Prix marché | Fournisseur conseillé | Total |
|---|---|---|---|---|
| Équipement principal | 1 | Prix fabricant | Cedeo / Rexel / Pro | variable |
| Vannes d'arrêt quart de tour | 4 | 12-18 € | Cedeo / Point P | 60,00 € |
| Raccords à sertir Ø16 (lot 10) | 2 | 18-25 € | Cedeo / Rexel | 42,00 € |
| Tuyaux multicouche Ø16 | 3 ml | 4-7 €/ml | Leroy Merlin / Cedeo | 16,00 € |
| Filtre anti-particules | 1 | 20-35 € | Cedeo / Sanitaire Pro | 25,00 € |

---

## 📈 ANALYSE STRATÉGIQUE

✅ **Chantier rapide et rentable** — 1 journée, marge ~38%
⚡ **Optimisation** — Négocier équipement chez distributeur agréé (remise pro 10-15%)
💡 **Upsell** — Proposer contrat maintenance annuelle (+120€/an récurrent)`,

  renovation: (surface) => `## ⚠️ POINTS D'ATTENTION CHANTIER

- **Amiante/plomb** : Diagnostic obligatoire avant démolition (construction <1997)
- **Murs porteurs** : Étude structure avant toute suppression de cloison
- **Mise aux normes électrique** : Tableau + circuits selon NF C 15-100 (2023)
- **Accès/stockage** : Prévoir zone de stockage matériaux + protection sols existants
- **Séquençage** : Gros œuvre → Électricité → Plomberie → Cloisons → Revêtements → Finitions

---

## 📄 DEVIS CLIENT — Rénovation Appartement ${surface}m²

| Désignation | Qté | Unité | PU HT | Total HT |
|---|---|---|---|---|
| Démolition cloisons existantes | ${Math.round(surface * 0.3)} | m² | 48,00 € | ${(Math.round(surface * 0.3) * 48).toFixed(2)} € |
| Évacuation gravats (bennes) | 2 | Forfait | 280,00 € | 560,00 € |
| Cloisons placo BA13 (y.c. ossature) | ${Math.round(surface * 0.4)} | m² | 62,00 € | ${(Math.round(surface * 0.4) * 62).toFixed(2)} € |
| Bandes à joint + enduit placo | ${Math.round(surface * 0.4 * 2)} | m² | 12,00 € | ${(Math.round(surface * 0.4 * 2) * 12).toFixed(2)} € |
| Enduit de finition murs | ${Math.round(surface * 3.5)} | m² | 9,00 € | ${(Math.round(surface * 3.5) * 9).toFixed(2)} € |
| Peinture murs + plafonds (2 couches) | ${Math.round(surface * 3.5)} | m² | 16,00 € | ${(Math.round(surface * 3.5) * 16).toFixed(2)} € |
| Primaire murs | ${Math.round(surface * 3.5)} | m² | 4,00 € | ${(Math.round(surface * 3.5) * 4).toFixed(2)} € |
| Revêtement sol stratifié AC4 | ${surface} | m² | 42,00 € | ${(surface * 42).toFixed(2)} € |
| Sous-couche acoustique | ${surface} | m² | 6,00 € | ${(surface * 6).toFixed(2)} € |
| Plinthes + profilés de seuil | ${Math.round(Math.sqrt(surface) * 4)} | ml | 8,00 € | ${(Math.round(Math.sqrt(surface) * 4) * 8).toFixed(2)} € |
| Électricité mise aux normes | ${surface} | m² | 38,00 € | ${(surface * 38).toFixed(2)} € |
| Tableau électrique + disjoncteurs | 1 | Forfait | 680,00 € | 680,00 € |
| Plomberie cuisine + SDB | 2 | Pièce | 1 950,00 € | 3 900,00 € |
| Menuiseries intérieures (portes) | 6 | unité | 340,00 € | 2 040,00 € |
| Quincaillerie (poignées, charnières) | 1 | Forfait | 180,00 € | 180,00 € |
| Protection sols pendant chantier | ${surface} | m² | 2,50 € | ${(surface * 2.50).toFixed(2)} € |
| Visserie, chevilles, consommables | 1 | Forfait | 120,00 € | 120,00 € |
| Nettoyage fin de chantier | 1 | Forfait | 480,00 € | 480,00 € |

**Durée estimée : ${Math.ceil(surface / 20)} semaines base × 1,15 contingence = ${Math.ceil(surface * 1.15 / 20)} semaines — Marge estimée : ~32%** ✅

---

## 🛒 LISTE DE COURSES FOURNISSEURS

| Fourniture | Qté | Prix marché | Fournisseur conseillé | Total estimé |
|---|---|---|---|---|
| Placo BA13 | ${Math.round(surface * 0.4)} m² | 8-12 €/m² | Bigmat / Point P | ${(Math.round(surface * 0.4) * 9).toFixed(2)} € |
| Stratifié AC4 | ${surface} m² | 15-28 €/m² | Brico Dépôt / Parquet+  | ${(surface * 20).toFixed(2)} € |
| Peinture (seau 15L) | ${Math.ceil(surface * 3.5 / 60)} seaux | 45-70 € | Leroy Merlin / Tollens  | ${(Math.ceil(surface * 3.5 / 60) * 55).toFixed(2)} € |
| Tableau élec. + coffret | 1 | 200-400 € | Rexel / Sonepar | 280,00 € |

---

## 📈 ANALYSE STRATÉGIQUE

✅ **Rentable** — Marge ~32%, volume CA important
⚡ **Optimisation** — Négocier volume matériaux (>2000€) : -7-10% chez Point P
📍 **Risque principal** — Découverte amiante ou murs porteurs peut décaler le planning
💡 **Option upsell** — Proposer VMC hygroréglable (+450€, marge 42%)`
};

function getApiKey() {
  try {
    const settings = db.prepare('SELECT anthropic_key FROM settings WHERE id = 1').get();
    const key = settings?.anthropic_key || process.env.ANTHROPIC_API_KEY || null;
    if (key && key.startsWith('sk-ant-')) return key;
    return null;
  } catch (e) {
    const key = process.env.ANTHROPIC_API_KEY || null;
    if (key && key.startsWith('sk-ant-')) return key;
    return null;
  }
}

function isDemoMode() {
  return !getApiKey();
}

function extractSurface(text) {
  const match = text.match(/(\d+)\s*m[²2]/i);
  return match ? parseInt(match[1]) : 12;
}

// Détecte le type de chantier depuis la description
function detectProjectType(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('salle de bain') || m.includes('sdb') || m.includes('salle d\'eau')) return 'sdb';
  if (m.includes('carrelage') || m.includes('carrel') || m.includes('faïence') || m.includes('faiencage')) return 'carrelage';
  if (m.includes('rénovation') || m.includes('renovation') || m.includes('appartement') || m.includes('maison')) return 'renovation';
  if (m.includes('adoucisseur') || m.includes('chaudière') || m.includes('chauffe-eau') || m.includes('plomberie')
    || m.includes('sanitaire') || m.includes('installation') || m.includes('tuyaux') || m.includes('vanne')
    || m.includes('raccord') || m.includes('ballon') || m.includes('pompe') || m.includes('filtre')) return 'plomberie';
  if (m.includes('peinture') || m.includes('enduit') || m.includes('ravalement')) return 'peinture';
  if (m.includes('électricité') || m.includes('electricite') || m.includes('tableau') || m.includes('câblage')) return 'electricite';
  if (m.includes('toiture') || m.includes('toit') || m.includes('tuile') || m.includes('ardoise') || m.includes('zinguerie')) return 'toiture';
  return 'generique';
}

function generateDemoResponse(message) {
  const msg = (message || '').toLowerCase();
  const type = detectProjectType(msg);
  const surface = extractSurface(msg);

  if (type === 'sdb') return DEMO_RESPONSES.salleDeBain(surface);
  if (type === 'carrelage') return DEMO_RESPONSES.carrelage(surface);
  if (type === 'renovation') return DEMO_RESPONSES.renovation(surface);
  if (type === 'plomberie') return DEMO_RESPONSES.plomberie(msg);
  return DEMO_RESPONSES.default(message);
}

// =============================================
//  MODE RÉEL — Anthropic API
// =============================================

let client = null;
let Anthropic = null;

const SYSTEM_PROMPT = `Tu es un expert BTP senior — chargé d'affaires avec 20+ ans d'expérience en rénovation et construction neuve. Tu maîtrises :
- Métré exhaustif (y compris TOUTES les petites fournitures souvent oubliées)
- Diagnostic anticipé des risques et difficultés chantier
- Sourcing matériaux et benchmark prix fournisseurs locaux
- Sous-détail de prix, optimisation de marge artisan

🎯 TU DOIS TOUJOURS CHALLENGER LE CHIFFRAGE en anticipant :
- Accessibilité (étage sans ascenseur, stationnement, couloir étroit)
- En rénovation : état probable des murs (humidité, fissures, décollement), des sols (planéité, nature sous-jacente), canalisations encastrées, présence amiante/plomb si <1997
- Éléments cachés à risque : gaines électriques sous enduit, renforts porteurs, raccords plomberie inaccessibles
- Petits travaux préparatoires souvent omis (ragréage, primaire, protection chantier, bâches, évacuation gravats)
- Outillage/consommables spécifiques (disques, forets, silicone, chevilles adaptées)

📐 MÉTHODE DE CHIFFRAGE OBLIGATOIRE :
- Matériaux : Prix fournisseur × 1,30 (majoration 30%)
- Main d'œuvre : taux horaire brut indiqué × heures estimées
- Déplacements : distance A/R × coût km × nombre de jours
- Durée : calcul détaillé poste par poste, puis ×1,15 (contingence 15% obligatoire), arrondir au jour supérieur

📦 LISTE DES FOURNITURES : Tu dois lister ABSOLUMENT TOUT :
joints, silicone, colle, primaire, bandes à joint, chevilles, vis, profilés de finition, bâches, protection sols, sacs de déchets, produit de nettoyage, etc.
Chaque ligne : désignation précise avec marque/qualité suggérée, quantité, unité, PU HT fournisseur, PU HT facturé (+30%), Total HT, Total TTC

📄 FORMAT DE SORTIE OBLIGATOIRE (respecter cet ordre exact) :

\`\`\`json
{
  "alertesChantier": ["alerte 1", "alerte 2", "..."],
  "lignes": [
    {
      "designation": "Désignation précise (marque/qualité)",
      "unite": "m²|u|ml|sac|h|forfait",
      "quantite": 10,
      "prixUnitaireHT": 45.00,
      "coutMateriau": 15.00,
      "coutMainOeuvre": 20.00,
      "heuresMO": 1.33,
      "notes": "note optionnelle"
    }
  ],
  "listeAchats": [
    {
      "designation": "Désignation fourniture",
      "quantite": 10,
      "unite": "m²",
      "prixAchatEstime": 18.50,
      "fournisseurConseille": "Brico Dépôt / Point P",
      "total": 185.00,
      "notes": "Prévoir 10% de chute"
    }
  ],
  "dureeDetaillee": "2j dépose + 3j pose = 5j × 1,15 = 5,75j → 6 jours",
  "totalHT": 0,
  "totalTVA": 0,
  "totalTTC": 0,
  "totalMaterials": 0,
  "totalLabor": 0,
  "totalTravel": 0,
  "margeBrute": 0,
  "tauxMarge": 0,
  "coutReel": 0,
  "rentabiliteHoraire": 0,
  "dureeJours": 1,
  "distanceKm": 0
}
\`\`\`

Puis après le JSON :

## ⚠️ POINTS D'ATTENTION CHANTIER
(liste détaillée des risques, vérifications avant démarrage, questions à poser au client)

## 📄 DEVIS CLIENT
(tableau markdown complet avec TOUTES les lignes)

## 📊 FICHE DE RENTABILITÉ (INTERNE)

## 🛒 LISTE DE COURSES FOURNISSEURS
(tableau avec prix marché, meilleurs fournisseurs locaux estimés, total achat)

## 📈 ANALYSE STRATÉGIQUE

Réponds TOUJOURS en français. Sois exhaustif — un devis incomplet coûte de l'argent à l'artisan.`;

function getClient() {
  if (isDemoMode()) return null;
  if (!client) {
    if (!Anthropic) Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: getApiKey() });
  }
  return client;
}

function resetClient() {
  client = null;
}

// =============================================
//  FONCTIONS EXPORTÉES
// =============================================

async function chat(history, userMessage, imageData, imageType) {
  if (isDemoMode()) {
    const content = generateDemoResponse(userMessage);
    return { content, devisData: null };
  }

  const anthropic = getClient();
  const messages = [];

  for (let i = 0; i < history.length - 1; i++) {
    const msg = history[i];
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  const currentContent = [];

  if (imageData && imageType) {
    currentContent.push({
      type: 'image',
      source: { type: 'base64', media_type: imageType, data: imageData }
    });
  }

  if (userMessage) {
    currentContent.push({ type: 'text', text: userMessage });
  }

  messages.push({
    role: 'user',
    content: currentContent.length === 1 && currentContent[0].type === 'text'
      ? currentContent[0].text
      : currentContent
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages
    });
    return { content: response.content[0].text, devisData: null };
  } catch (err) {
    if (err.status === 401) {
      client = null;
      throw new Error('Clé API Anthropic invalide. Rendez-vous dans Paramètres pour corriger votre clé (format attendu : sk-ant-...).');
    }
    throw err;
  }
}

async function analyzeImage(base64, mimeType) {
  if (isDemoMode()) {
    return `## Analyse d'image (Mode Démo)

**Type :** Plan / Photo de chantier détecté

**Éléments identifiés :**
- Surface estimée : ~12-15 m²
- Présence de cloisons / murs porteurs à vérifier
- Sol existant à déposer
- Ouvertures (portes/fenêtres) visibles

**Points d'attention :**
- Vérifier nature du sol sous-jacent
- Repérer passages de canalisations

**Chiffrage préliminaire :**
- Travaux de démolition : ~180-220 €
- Revêtements : ~400-600 €
- Finitions : ~200-300 €

*Mode démo actif — Configurez une clé API Anthropic pour l'analyse réelle des images.*`;
  }

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: `En tant qu'expert BTP senior, analyse cette image et fournis :
1. Type d'image (plan, photo chantier, photo avant travaux...)
2. Dimensions et surfaces estimées
3. Éléments identifiés (matériaux, équipements, structure)
4. Points d'attention et risques potentiels
5. Travaux nécessaires avec quantités estimées
6. Chiffrage préliminaire HT par poste` }
      ]
    }]
  });
  return response.content[0].text;
}

async function generateDevisFromDescription(description, settings) {
  // MODE DÉMO
  if (isDemoMode()) {
    const msg = (description || '').toLowerCase();
    const surface = extractSurface(description);
    const type = detectProjectType(msg);
    const tva = settings?.tva_rate || 10;

    let response = '';
    let jsonData = null;

    if (type === 'sdb') {
      response = DEMO_RESPONSES.salleDeBain(surface);
      const dureeBase = 9; const dureeJours = 9;
      const totalHT = surface * 180;
      const totalTVA = totalHT * tva / 100;
      jsonData = {
        alertesChantier: ['Vérifier présence amiante (construction <1997)','Contrôler étanchéité murs (humidité)','Repérer canalisations avant perçage','Prévoir évacuation gravats'],
        lignes: [
          { designation: 'Dépose carrelage sol existant', unite: 'm²', quantite: surface, prixUnitaireHT: 18, coutMateriau: 2, coutMainOeuvre: 16, heuresMO: 1, notes: '' },
          { designation: 'Dépose carrelage mural', unite: 'm²', quantite: surface * 2.5, prixUnitaireHT: 15, coutMateriau: 1, coutMainOeuvre: 14, heuresMO: 0.9, notes: '' },
          { designation: 'Évacuation gravats', unite: 'forfait', quantite: 1, prixUnitaireHT: 220, coutMateriau: 220, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Ragréage sol autonivelant', unite: 'm²', quantite: surface, prixUnitaireHT: 22, coutMateriau: 16, coutMainOeuvre: 6, heuresMO: 0.4, notes: '' },
          { designation: `Carrelage sol grès cérame 60×60 (+10%)`, unite: 'm²', quantite: Math.ceil(surface * 1.1), prixUnitaireHT: 32, coutMateriau: 22, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Pose carrelage sol', unite: 'm²', quantite: surface, prixUnitaireHT: 42, coutMateriau: 0, coutMainOeuvre: 42, heuresMO: 2.8, notes: '' },
          { designation: 'Colle C2 flexible (sac 25kg)', unite: 'sac', quantite: Math.ceil(surface / 4), prixUnitaireHT: 26, coutMateriau: 19, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: `Faïence murale 30×60 (+10%)`, unite: 'm²', quantite: Math.ceil(surface * 2.5 * 1.1), prixUnitaireHT: 28, coutMateriau: 20, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Pose faïence murale', unite: 'm²', quantite: surface * 2.5, prixUnitaireHT: 48, coutMateriau: 0, coutMainOeuvre: 48, heuresMO: 3.2, notes: '' },
          { designation: 'Joint époxy sol + mur', unite: 'sac', quantite: Math.ceil((surface + surface * 2.5) / 12), prixUnitaireHT: 44, coutMateriau: 34, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Silicone sanitaire (cartouche)', unite: 'u', quantite: 3, prixUnitaireHT: 8, coutMateriau: 6, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Receveur douche italienne 90×90', unite: 'u', quantite: 1, prixUnitaireHT: 420, coutMateriau: 320, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Paroi douche verre 8mm', unite: 'u', quantite: 1, prixUnitaireHT: 585, coutMateriau: 450, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Plomberie dépose + repose sanitaires', unite: 'forfait', quantite: 1, prixUnitaireHT: 680, coutMateriau: 120, coutMainOeuvre: 560, heuresMO: 8, notes: '' },
          { designation: 'Visserie, chevilles, profilés, consommables', unite: 'forfait', quantite: 1, prixUnitaireHT: 55, coutMateriau: 55, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Nettoyage fin de chantier', unite: 'forfait', quantite: 1, prixUnitaireHT: 180, coutMateriau: 20, coutMainOeuvre: 160, heuresMO: 2, notes: '' }
        ],
        listeAchats: [
          { designation: 'Carrelage grès cérame 60×60', quantite: Math.ceil(surface * 1.1), unite: 'm²', prixAchatEstime: 22, fournisseurConseille: 'Brico Dépôt / Leroy Merlin', total: Math.ceil(surface * 1.1) * 22, notes: '+10% chute' },
          { designation: 'Faïence murale 30×60', quantite: Math.ceil(surface * 2.5 * 1.1), unite: 'm²', prixAchatEstime: 20, fournisseurConseille: 'Leroy Merlin / Point P', total: Math.ceil(surface * 2.5 * 1.1) * 20, notes: '' },
          { designation: 'Receveur douche italienne', quantite: 1, unite: 'u', prixAchatEstime: 320, fournisseurConseille: 'Brico Dépôt / Cedeo', total: 320, notes: '' },
          { designation: 'Paroi douche verre 8mm', quantite: 1, unite: 'u', prixAchatEstime: 450, fournisseurConseille: 'Leroy Merlin / GSB', total: 450, notes: '' }
        ],
        dureeDetaillee: `4j dépose+carrelage + 2j plomberie + 1j peinture + 2j finitions = 9j (contingence 15% incluse)`,
        totalHT, totalTVA, totalTTC: totalHT + totalTVA,
        totalMaterials: totalHT * 0.55, totalLabor: totalHT * 0.42, totalTravel: 45,
        margeBrute: totalHT * 0.34, tauxMarge: 34, coutReel: totalHT * 0.66,
        rentabiliteHoraire: (totalHT * 0.34) / (dureeJours * 8), dureeJours, distanceKm: 25
      };

    } else if (type === 'carrelage') {
      response = DEMO_RESPONSES.carrelage(surface);
      const dureeBase = Math.ceil(surface / 15) + 1; const dureeJours = Math.ceil(dureeBase * 1.15);
      const totalHT = surface * 120;
      const totalTVA = totalHT * tva / 100;
      jsonData = {
        alertesChantier: ['Vérifier planéité du support (ragréage probable si écart >3mm)','Identifier nature du sol sous-jacent (parquet, béton, chape)','Chauffage au sol : désactiver 48h avant, colle flexible C2S1 obligatoire'],
        lignes: [
          { designation: 'Dépose ancien revêtement', unite: 'm²', quantite: surface, prixUnitaireHT: 14, coutMateriau: 2, coutMainOeuvre: 12, heuresMO: 0.8, notes: '' },
          { designation: 'Évacuation déchets', unite: 'forfait', quantite: 1, prixUnitaireHT: 150, coutMateriau: 150, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Ragréage autonivelant (sac 25kg)', unite: 'sac', quantite: Math.ceil(surface / 6), prixUnitaireHT: 28, coutMateriau: 20, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Primaire d\'accrochage', unite: 'm²', quantite: surface, prixUnitaireHT: 5, coutMateriau: 4, coutMainOeuvre: 1, heuresMO: 0.05, notes: '' },
          { designation: `Carrelage 60×60 grès cérame (+10%)`, unite: 'm²', quantite: Math.ceil(surface * 1.1), prixUnitaireHT: 28, coutMateriau: 20, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Colle C2 flexible (sac 25kg)', unite: 'sac', quantite: Math.ceil(surface / 4), prixUnitaireHT: 26, coutMateriau: 19, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Pose carrelage (y.c. découpes)', unite: 'm²', quantite: surface, prixUnitaireHT: 38, coutMateriau: 0, coutMainOeuvre: 38, heuresMO: 2.5, notes: '' },
          { designation: 'Joint époxy (sac 5kg)', unite: 'sac', quantite: Math.ceil(surface / 12), prixUnitaireHT: 44, coutMateriau: 34, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Plinthes assorties', unite: 'ml', quantite: Math.ceil(Math.sqrt(surface) * 4), prixUnitaireHT: 9.5, coutMateriau: 7, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Profilés de transition', unite: 'ml', quantite: 2, prixUnitaireHT: 12, coutMateriau: 9, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Bâches protection + consommables', unite: 'forfait', quantite: 1, prixUnitaireHT: 40, coutMateriau: 40, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Nettoyage fin de chantier', unite: 'forfait', quantite: 1, prixUnitaireHT: 120, coutMateriau: 15, coutMainOeuvre: 105, heuresMO: 1.5, notes: '' }
        ],
        listeAchats: [
          { designation: 'Carrelage 60×60', quantite: Math.ceil(surface * 1.1), unite: 'm²', prixAchatEstime: 18, fournisseurConseille: 'Brico Dépôt / Point P', total: Math.ceil(surface * 1.1) * 18, notes: '+10% chute' },
          { designation: 'Colle C2 flexible (25kg)', quantite: Math.ceil(surface / 4), unite: 'sac', prixAchatEstime: 19, fournisseurConseille: 'Point P / Bigmat', total: Math.ceil(surface / 4) * 19, notes: '' },
          { designation: 'Joint époxy (5kg)', quantite: Math.ceil(surface / 12), unite: 'sac', prixAchatEstime: 34, fournisseurConseille: 'Leroy Merlin', total: Math.ceil(surface / 12) * 34, notes: '' }
        ],
        dureeDetaillee: `1j préparation + ${Math.ceil(surface / 15)}j pose = ${dureeBase}j × 1,15 = ${dureeJours} jours`,
        totalHT, totalTVA, totalTTC: totalHT + totalTVA,
        totalMaterials: totalHT * 0.55, totalLabor: totalHT * 0.42, totalTravel: 45,
        margeBrute: totalHT * 0.36, tauxMarge: 36, coutReel: totalHT * 0.64,
        rentabiliteHoraire: (totalHT * 0.36) / (dureeJours * 8), dureeJours, distanceKm: 25
      };

    } else if (type === 'plomberie') {
      response = DEMO_RESPONSES.plomberie(msg);
      const dureeJours = 1;
      const totalHT = 1250;
      const totalTVA = totalHT * tva / 100;
      jsonData = {
        alertesChantier: [
          'Localiser et couper la vanne d\'arrêt générale avant intervention',
          'Vérifier pression réseau compatible avec l\'équipement (1,5-3 bar)',
          'S\'assurer que le local d\'installation est accessible et débarrassé',
          'Vérifier compatibilité des raccords existants (diamètre, matière)',
          'Prévoir évacuation si nécessaire (siphon ou vidange à proximité)'
        ],
        lignes: [
          { designation: 'Fourniture équipement principal (réf. selon commande client)', unite: 'u', quantite: 1, prixUnitaireHT: 580, coutMateriau: 446, coutMainOeuvre: 0, heuresMO: 0, notes: 'Prix indicatif — ajuster selon devis fabricant' },
          { designation: 'Fourniture vannes d\'arrêt quart de tour', unite: 'u', quantite: 4, prixUnitaireHT: 22, coutMateriau: 17, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Fourniture raccords à sertir (lot)', unite: 'forfait', quantite: 1, prixUnitaireHT: 65, coutMateriau: 50, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Tuyaux multicouche Ø16 ou Ø20', unite: 'ml', quantite: 3, prixUnitaireHT: 8.5, coutMateriau: 6.5, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Coudes, tés, jonctions (lot)', unite: 'forfait', quantite: 1, prixUnitaireHT: 58, coutMateriau: 45, coutMainOeuvre: 0, heuresMO: 0, notes: '' },
          { designation: 'Fourniture filtre anti-particules', unite: 'u', quantite: 1, prixUnitaireHT: 49, coutMateriau: 38, coutMainOeuvre: 0, heuresMO: 0, notes: 'Recommandé en amont de l\'équipement' },
          { designation: 'Pose et raccordement (installation complète)', unite: 'forfait', quantite: 1, prixUnitaireHT: 280, coutMateriau: 0, coutMainOeuvre: 280, heuresMO: 4, notes: '' },
          { designation: 'Test d\'étanchéité + mise en service + formation', unite: 'forfait', quantite: 1, prixUnitaireHT: 80, coutMateriau: 0, coutMainOeuvre: 80, heuresMO: 1, notes: '' },
          { designation: 'Protection sol + évacuation emballages', unite: 'forfait', quantite: 1, prixUnitaireHT: 30, coutMateriau: 30, coutMainOeuvre: 0, heuresMO: 0, notes: '' }
        ],
        listeAchats: [
          { designation: 'Équipement principal (réf. fabricant)', quantite: 1, unite: 'u', prixAchatEstime: 446, fournisseurConseille: 'Cedeo / Rexel / distributeur agréé', total: 446, notes: 'Demander remise pro 10-15%' },
          { designation: 'Vannes d\'arrêt quart de tour', quantite: 4, unite: 'u', prixAchatEstime: 14, fournisseurConseille: 'Cedeo / Point P', total: 56, notes: '' },
          { designation: 'Raccords à sertir (lot)', quantite: 1, unite: 'forfait', prixAchatEstime: 45, fournisseurConseille: 'Cedeo / Rexel', total: 45, notes: '' },
          { designation: 'Tuyaux multicouche Ø16', quantite: 3, unite: 'ml', prixAchatEstime: 5, fournisseurConseille: 'Leroy Merlin / Cedeo', total: 15, notes: '' },
          { designation: 'Filtre anti-particules', quantite: 1, unite: 'u', prixAchatEstime: 28, fournisseurConseille: 'Cedeo / Sanitaire Pro', total: 28, notes: '' }
        ],
        dureeDetaillee: `Installation + tests = 5h × 1,15 contingence = 1 journée`,
        totalHT, totalTVA, totalTTC: totalHT + totalTVA,
        totalMaterials: 700, totalLabor: 480, totalTravel: 45,
        margeBrute: totalHT * 0.38, tauxMarge: 38, coutReel: totalHT * 0.62,
        rentabiliteHoraire: (totalHT * 0.38) / (dureeJours * 8), dureeJours, distanceKm: 25
      };

    } else {
      // Fallback générique : renovation
      response = DEMO_RESPONSES.renovation(surface || 30);
      const s = surface || 30;
      const dureeBase = Math.ceil(s / 10); const dureeJours = Math.ceil(dureeBase * 1.15);
      const totalHT = s * 145;
      const totalTVA = totalHT * tva / 100;
      jsonData = {
        alertesChantier: [
          'Configurer une clé API Anthropic (Paramètres) pour un devis adapté à votre projet',
          'Ce devis démo est générique — les lignes sont à ajuster selon votre chantier réel',
          'Vérifier accessibilité du chantier et stationnement matériel',
          'Identifier tous les intervenants nécessaires (électricien, plombier, maçon...)'
        ],
        lignes: [
          { designation: '⚠️ DEMO — Ajustez les lignes selon votre projet réel', unite: 'forfait', quantite: 1, prixUnitaireHT: totalHT * 0.6, coutMateriau: totalHT * 0.4, coutMainOeuvre: totalHT * 0.2, heuresMO: dureeJours * 6, notes: 'Ligne générique à remplacer' },
          { designation: 'Main d\'œuvre (estimation)', unite: 'h', quantite: dureeJours * 8, prixUnitaireHT: 45, coutMateriau: 0, coutMainOeuvre: 45, heuresMO: 1, notes: '' },
          { designation: 'Déplacements (estimation)', unite: 'forfait', quantite: 1, prixUnitaireHT: 45, coutMateriau: 0, coutMainOeuvre: 45, heuresMO: 0, notes: '' }
        ],
        listeAchats: [],
        dureeDetaillee: `Estimation générique ${dureeBase}j × 1,15 = ${dureeJours} jours (à affiner selon projet)`,
        totalHT, totalTVA, totalTTC: totalHT + totalTVA,
        totalMaterials: totalHT * 0.5, totalLabor: totalHT * 0.45, totalTravel: 45,
        margeBrute: totalHT * 0.32, tauxMarge: 32, coutReel: totalHT * 0.68,
        rentabiliteHoraire: (totalHT * 0.32) / (dureeJours * 8), dureeJours, distanceKm: 25
      };
    }

    return `\`\`\`json\n${JSON.stringify(jsonData, null, 2)}\n\`\`\`\n\n${response}`;
  }

  // MODE RÉEL
  const anthropic = getClient();
  const tvaRate = settings?.tva_rate || 10;
  const hourlyRate = settings?.hourly_rate || 15;
  const marginMaterial = settings?.margin_material || 30;
  const kmRate = settings?.km_rate || 0.30;

  const prompt = `Génère un devis complet, exhaustif et challengé pour ce projet BTP :

${description}

Paramètres entreprise :
- Taux horaire MO : ${hourlyRate} €/h
- Majoration matériaux : ${marginMaterial}%
- Coût km : ${kmRate} €/km
- TVA : ${tvaRate}%

RAPPELS IMPORTANTS :
1. Liste ABSOLUMENT TOUTES les fournitures (même petites : vis, joints, silicone, primaire, bâches...)
2. Calcule la durée réaliste puis applique ×1,15 de contingence
3. Inclus les alertes/risques dans alertesChantier
4. Fournis une liste de courses avec prix marché actuels et fournisseurs conseillés
5. Commence ta réponse par le bloc JSON, puis les sections markdown

Respecte strictement le format JSON demandé dans les instructions système.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text;
  } catch (err) {
    if (err.status === 401) {
      client = null;
      throw new Error('Clé API Anthropic invalide.');
    }
    throw err;
  }
}

module.exports = { chat, analyzeImage, generateDevisFromDescription, resetClient, isDemoMode };
