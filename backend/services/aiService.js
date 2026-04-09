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
- Je génère un devis structuré

---

💡 **Vous avez écrit :** "${msg?.substring(0, 100) || '...'}"

Pour tester l'application, utilisez le bouton **"Nouveau Devis"** dans le menu de gauche et remplissez le formulaire de saisie manuelle.`,

  salleDeBain: (surface) => `## 📄 DEVIS CLIENT — Rénovation Salle de Bain

| Désignation | Qté | Unité | PU HT | Total HT |
|---|---|---|---|---|
| Dépose carrelage existant | ${surface} | m² | 15,00 € | ${(surface * 15).toFixed(2)} € |
| Pose carrelage sol (gamme standard) | ${surface} | m² | 45,00 € | ${(surface * 45).toFixed(2)} € |
| Pose carrelage mural | ${surface * 2.5} | m² | 50,00 € | ${(surface * 2.5 * 50).toFixed(2)} € |
| Fourniture sanitaires (WC + lavabo + douche) | 1 | Forfait | 1 200,00 € | 1 200,00 € |
| Plomberie — dépose + repose | 1 | Forfait | 800,00 € | 800,00 € |
| Peinture plafond | ${surface} | m² | 18,00 € | ${(surface * 18).toFixed(2)} € |
| Nettoyage chantier | 1 | Forfait | 150,00 € | 150,00 € |

**Total HT :** ${(surface * 15 + surface * 45 + surface * 2.5 * 50 + 1200 + 800 + surface * 18 + 150).toFixed(2)} €
**TVA 10% :** ${(surface * 15 + surface * 45 + surface * 2.5 * 50 + 1200 + 800 + surface * 18 + 150) * 0.1} €
**Total TTC :** ${((surface * 15 + surface * 45 + surface * 2.5 * 50 + 1200 + 800 + surface * 18 + 150) * 1.1).toFixed(2)} €

---

## 📊 FICHE DE RENTABILITÉ (INTERNE)

| Poste | Coût réel | Facturé | Marge |
|---|---|---|---|
| Carrelage sol | ${(surface * 11.50).toFixed(2)} € | ${(surface * 45).toFixed(2)} € | ${Math.round((1 - 11.5/45) * 100)}% |
| Carrelage mural | ${(surface * 2.5 * 12).toFixed(2)} € | ${(surface * 2.5 * 50).toFixed(2)} € | ${Math.round((1 - 12/50) * 100)}% |
| Sanitaires | 850,00 € | 1 200,00 € | 29% |
| MO totale | ${(surface * 8 * 15).toFixed(2)} € | — | — |

**Taux de marge global estimé : ~32%** ✅

---

## 📈 ANALYSE STRATÉGIQUE

✅ **Chantier rentable** — Marge > 30%, dans la cible
⚡ **Optimisation possible** — Achats groupés carrelage peuvent économiser 8-12%
📍 **Point d'attention** — Vérifier état des canalisations avant chiffrage définitif
💡 **Recommandation** — Proposer option douche italienne (+15% CA, même rentabilité)`,

  carrelage: (surface) => `## 📄 DEVIS CLIENT — Pose Carrelage

| Désignation | Qté | Unité | PU HT | Total HT |
|---|---|---|---|---|
| Dépose ancien revêtement | ${surface} | m² | 12,00 € | ${(surface * 12).toFixed(2)} € |
| Préparation support (ragréage) | ${surface} | m² | 8,00 € | ${(surface * 8).toFixed(2)} € |
| Fourniture carrelage 60×60 | ${Math.ceil(surface * 1.1)} | m² | 22,00 € | ${(Math.ceil(surface * 1.1) * 22).toFixed(2)} € |
| Pose carrelage | ${surface} | m² | 35,00 € | ${(surface * 35).toFixed(2)} € |
| Joints et finitions | ${surface} | m² | 5,00 € | ${(surface * 5).toFixed(2)} € |
| Nettoyage | 1 | Forfait | 100,00 € | 100,00 € |

**Total HT :** ${(surface * 12 + surface * 8 + Math.ceil(surface * 1.1) * 22 + surface * 35 + surface * 5 + 100).toFixed(2)} €
**TVA 10% :** ${((surface * 12 + surface * 8 + Math.ceil(surface * 1.1) * 22 + surface * 35 + surface * 5 + 100) * 0.1).toFixed(2)} €
**Total TTC :** ${((surface * 12 + surface * 8 + Math.ceil(surface * 1.1) * 22 + surface * 35 + surface * 5 + 100) * 1.1).toFixed(2)} €

**Marge estimée : ~35%** ✅`,

  renovation: (surface) => `## 📄 DEVIS CLIENT — Rénovation Appartement

| Désignation | Qté | Unité | PU HT | Total HT |
|---|---|---|---|---|
| Démolition cloisons existantes | ${Math.round(surface * 0.3)} | m² | 45,00 € | ${(Math.round(surface * 0.3) * 45).toFixed(2)} € |
| Cloisons placo BA13 | ${Math.round(surface * 0.4)} | m² | 55,00 € | ${(Math.round(surface * 0.4) * 55).toFixed(2)} € |
| Enduit + peinture murs | ${Math.round(surface * 3.5)} | m² | 18,00 € | ${(Math.round(surface * 3.5) * 18).toFixed(2)} € |
| Revêtement sol stratifié | ${surface} | m² | 38,00 € | ${(surface * 38).toFixed(2)} € |
| Électricité mise aux normes | ${surface} | m² | 35,00 € | ${(surface * 35).toFixed(2)} € |
| Plomberie (cuisine + SDB) | 2 | Pièce | 1 800,00 € | 3 600,00 € |
| Menuiseries intérieures | 6 | Unité | 320,00 € | 1 920,00 € |
| Nettoyage fin de chantier | 1 | Forfait | 400,00 € | 400,00 € |

**Total HT :** ${(Math.round(surface * 0.3) * 45 + Math.round(surface * 0.4) * 55 + Math.round(surface * 3.5) * 18 + surface * 38 + surface * 35 + 3600 + 1920 + 400).toFixed(2)} €
**TVA 10% :** ${((Math.round(surface * 0.3) * 45 + Math.round(surface * 0.4) * 55 + Math.round(surface * 3.5) * 18 + surface * 38 + surface * 35 + 3600 + 1920 + 400) * 0.1).toFixed(2)} €
**Total TTC :** ${((Math.round(surface * 0.3) * 45 + Math.round(surface * 0.4) * 55 + Math.round(surface * 3.5) * 18 + surface * 38 + surface * 35 + 3600 + 1920 + 400) * 1.1).toFixed(2)} €

**Durée estimée : ${Math.ceil(surface / 10)} semaines — Marge estimée : ~31%** ✅`
};

function getApiKey() {
  try {
    const settings = db.prepare('SELECT anthropic_key FROM settings WHERE id = 1').get();
    return settings?.anthropic_key || process.env.ANTHROPIC_API_KEY || null;
  } catch (e) {
    return process.env.ANTHROPIC_API_KEY || null;
  }
}

function isDemoMode() {
  return !getApiKey();
}

// Détecter la surface dans le message
function extractSurface(text) {
  const match = text.match(/(\d+)\s*m[²2]/i);
  return match ? parseInt(match[1]) : 12;
}

// Générer une réponse démo réaliste selon le contexte
function generateDemoResponse(message) {
  const msg = (message || '').toLowerCase();

  if (msg.includes('salle de bain') || msg.includes('sdb') || msg.includes('salle d\'eau')) {
    const surface = extractSurface(msg);
    return DEMO_RESPONSES.salleDeBain(surface);
  }

  if (msg.includes('carrelage') || msg.includes('carrel')) {
    const surface = extractSurface(msg);
    return DEMO_RESPONSES.carrelage(surface);
  }

  if (msg.includes('rénovation') || msg.includes('renovation') || msg.includes('appartement') || msg.includes('maison')) {
    const surface = extractSurface(msg);
    return DEMO_RESPONSES.renovation(surface);
  }

  return DEMO_RESPONSES.default(message);
}

// =============================================
//  MODE RÉEL — Anthropic API
// =============================================

let client = null;
let Anthropic = null;

const SYSTEM_PROMPT = `Tu es un agent autonome expert en étude de prix BTP, gestion artisanale, optimisation de marge et consultation fournisseurs locaux.

Tu agis comme un chargé d'affaires BTP senior maîtrisant :
- Métré et déboursé sec
- Sous-détail de prix
- Optimisation de rentabilité
- Négociation fournisseurs
- Stratégie de marge artisan

Tu raisonnes toujours en logique d'entreprise rentable, pas seulement en logique technique.

🎯 MISSION
À partir des besoins client, de l'adresse du chantier, des contraintes techniques et du délai souhaité, tu dois produire :
1️⃣ Un devis client professionnel conforme
2️⃣ Une fiche de rentabilité interne ultra détaillée
3️⃣ Une analyse stratégique de marge avec recommandations

📐 MÉTHODE DE CHIFFRAGE OBLIGATOIRE
Matériaux : Prix fournisseur × 1,30 (majoration obligatoire 30%)
Main d'œuvre : Taux horaire brut fixe : 15 €/h
Déplacements : Distance A/R × 0,30 € × nombre de jours

📄 FORMAT DE SORTIE OBLIGATOIRE :
📄 DEVIS CLIENT (tableau : Désignation | Qté | PU HT | Total HT)
📊 FICHE DE RENTABILITÉ (INTERNE)
📈 ANALYSE STRATÉGIQUE

🛑 RÈGLES : Toujours appliquer 30% matériaux, intégrer km, détailler MO.
Réponds toujours en français, de façon professionnelle mais accessible pour un artisan.`;

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
  // MODE DÉMO
  if (isDemoMode()) {
    const content = generateDemoResponse(userMessage);
    return { content, devisData: null };
  }

  // MODE RÉEL
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

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages
  });

  return { content: response.content[0].text, devisData: null };
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
        { type: 'text', text: `En tant qu'expert BTP, analyse cette image et fournis : type d'image, dimensions visibles, surfaces estimées, éléments identifiés, travaux nécessaires, quantités estimées, chiffrage préliminaire.` }
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

    let response = '';

    if (msg.includes('salle de bain') || msg.includes('sdb')) {
      response = DEMO_RESPONSES.salleDeBain(surface);
    } else if (msg.includes('carrelage')) {
      response = DEMO_RESPONSES.carrelage(surface);
    } else if (msg.includes('rénovation') || msg.includes('appartement')) {
      response = DEMO_RESPONSES.renovation(surface);
    } else {
      response = DEMO_RESPONSES.renovation(surface || 30);
    }

    // JSON démo pour extraction
    const totalHT = surface * 130;
    const totalTVA = totalHT * (settings?.tva_rate || 10) / 100;
    const jsonData = {
      lignes: [
        { designation: 'Préparation et dépose', unite: 'm²', quantite: surface, prixUnitaireHT: 20, coutMateriau: 5, coutMainOeuvre: 15, heuresMO: 1 },
        { designation: 'Fournitures matériaux', unite: 'm²', quantite: surface, prixUnitaireHT: 65, coutMateriau: 50, coutMainOeuvre: 0, heuresMO: 0 },
        { designation: 'Main d\'oeuvre pose', unite: 'h', quantite: surface * 1.5, prixUnitaireHT: 45, coutMateriau: 0, coutMainOeuvre: 15, heuresMO: 1 }
      ],
      totalHT, totalTVA,
      totalTTC: totalHT + totalTVA,
      totalMaterials: surface * 65,
      totalLabor: surface * 1.5 * 45,
      totalTravel: 45,
      margeBrute: totalHT * 0.32,
      tauxMarge: 32,
      coutReel: totalHT * 0.68,
      dureeJours: Math.ceil(surface / 8),
      distanceKm: 25
    };

    return `\`\`\`json\n${JSON.stringify(jsonData, null, 2)}\n\`\`\`\n\n${response}`;
  }

  // MODE RÉEL
  const anthropic = getClient();
  const prompt = `Génère un devis complet pour ce projet BTP :

${description}

Paramètres entreprise :
- Taux horaire MO : ${settings?.hourly_rate || 15} €/h
- Majoration matériaux : ${settings?.margin_material || 30}%
- Coût km : ${settings?.km_rate || 0.30} €/km
- TVA : ${settings?.tva_rate || 10}%

Génère :
1. Le détail ligne par ligne du devis (format JSON strict ci-dessous)
2. La fiche de rentabilité
3. L'analyse stratégique

Format JSON strict :
\`\`\`json
{
  "lignes": [{"designation":"...","unite":"m²","quantite":10,"prixUnitaireHT":45,"coutMateriau":15,"coutMainOeuvre":20,"heuresMO":1.33,"notes":""}],
  "totalHT":0,"totalTVA":0,"totalTTC":0,"totalMaterials":0,"totalLabor":0,"totalTravel":0,
  "margeBrute":0,"tauxMarge":0,"coutReel":0,"dureeJours":1,"distanceKm":0
}
\`\`\``;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

module.exports = { chat, analyzeImage, generateDevisFromDescription, resetClient, isDemoMode };
