require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../database/db');

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

🧠 COMPORTEMENT AUTONOME
Si une information manque, pose uniquement les questions strictement nécessaires :
- Surface exacte ?
- Hauteur sous plafond ?
- Accès chantier ?
- État du support ?
- Fourniture ou pose seule ?
- Délai imposé ?
Ne jamais supposer des données critiques.

📐 MÉTHODE DE CHIFFRAGE OBLIGATOIRE

A — Déboursé sec :
Matériaux : Prix fournisseur × 1,30 (majoration obligatoire 30%)
Main d'œuvre : Taux horaire brut fixe : 15 €/h
Tu estimes le temps par tâche + temps improductif (préparation, nettoyage, logistique)
Déplacements : Distance domicile ↔ chantier, Aller-retour × 0,30 € × nombre de jours

B — Structure de prix (pour chaque poste) :
- Quantité
- Prix unitaire HT
- Total HT
- Détail matériaux
- Détail main d'œuvre
- Détail frais annexes

📄 FORMAT DE SORTIE OBLIGATOIRE pour les devis complets :
Toujours structurer exactement :

📄 DEVIS CLIENT
(Devis propre avec tableau des prestations : Désignation | Qté | PU HT | Total HT)

📊 FICHE DE RENTABILITÉ (INTERNE)
(Tableaux : Poste | Coût réel matériaux | Coût réel MO | Coût réel total)
(Analyse : CA HT | Coût total réel | Marge brute | Taux de marge global | Rentabilité horaire)

📈 ANALYSE STRATÉGIQUE
(Chantier rentable ou risqué ? Recommandations d'optimisation)

🛑 RÈGLES ABSOLUES :
- Toujours appliquer la majoration 30% sur les matériaux
- Toujours intégrer frais kilométriques
- Toujours détailler la main d'œuvre
- Toujours séparer devis et rentabilité
- Toujours afficher les calculs intermédiaires
- Ne jamais mélanger données client et données internes
- Ne jamais inventer une info critique

🔍 ANALYSE D'IMAGES :
Quand tu reçois une image (plan, photo de chantier) :
- Identifie les dimensions visibles
- Estime les surfaces
- Note les éléments (murs, sols, ouvertures, équipements)
- Propose un chiffrage basé sur l'analyse visuelle
- Précise les incertitudes et ce qui nécessite confirmation

Réponds toujours en français, de façon professionnelle mais accessible pour un artisan.`;

let client = null;

function getClient() {
  if (!client) {
    const settings = db.prepare('SELECT anthropic_key FROM settings WHERE id = 1').get();
    const apiKey = settings?.anthropic_key || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Clé API Anthropic non configurée. Allez dans Paramètres.');
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Réinitialiser le client si la clé change
function resetClient() {
  client = null;
}

async function chat(history, userMessage, imageData, imageType) {
  const anthropic = getClient();

  // Construire les messages pour l'API
  const messages = [];

  // Ajouter l'historique (sauf le dernier message user qui sera ajouté avec l'image)
  for (let i = 0; i < history.length - 1; i++) {
    const msg = history[i];
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Construire le message utilisateur actuel
  const currentContent = [];

  if (imageData && imageType) {
    currentContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: imageType,
        data: imageData
      }
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

  const content = response.content[0].text;

  // Détecter si la réponse contient un devis structuré à sauvegarder
  // (on cherche les marqueurs clés)
  let devisData = null;

  return { content, devisData };
}

async function analyzeImage(base64, mimeType) {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 }
        },
        {
          type: 'text',
          text: `En tant qu'expert BTP, analyse cette image et fournis :

1. TYPE D'IMAGE : Plan / Photo chantier / Autre
2. DIMENSIONS VISIBLES : Liste toutes les cotes et dimensions repérables
3. SURFACES ESTIMÉES : Calcule les surfaces en m² (sol, murs, plafond si visible)
4. ÉLÉMENTS IDENTIFIÉS : Murs, ouvertures (portes/fenêtres), équipements, sol
5. TRAVAUX IDENTIFIÉS : Quels travaux semblent nécessaires ou sont représentés
6. QUANTITÉS ESTIMÉES : Matériaux nécessaires avec quantités approximatives
7. POINTS D'ATTENTION : Ce qui nécessite confirmation sur site
8. CHIFFRAGE PRÉLIMINAIRE : Estimation rapide des coûts principaux

Sois précis et professionnel. Indique clairement les incertitudes.`
        }
      ]
    }]
  });

  return response.content[0].text;
}

async function generateDevisFromDescription(description, settings) {
  const anthropic = getClient();

  const prompt = `Génère un devis complet pour ce projet BTP :

${description}

Paramètres entreprise :
- Taux horaire MO : ${settings.hourly_rate || 15} €/h
- Majoration matériaux : ${settings.margin_material || 30}%
- Coût km : ${settings.km_rate || 0.30} €/km
- TVA : ${settings.tva_rate || 10}%

Génère :
1. Le détail ligne par ligne du devis (format JSON strict)
2. La fiche de rentabilité
3. L'analyse stratégique

Pour le JSON, utilise ce format exact :
\`\`\`json
{
  "lignes": [
    {
      "designation": "...",
      "unite": "m²",
      "quantite": 10,
      "prixUnitaireHT": 45,
      "coutMateriau": 15,
      "coutMainOeuvre": 20,
      "heuresMO": 1.33,
      "notes": "..."
    }
  ],
  "totalHT": 0,
  "totalTVA": 0,
  "totalTTC": 0,
  "totalMaterials": 0,
  "totalLabor": 0,
  "totalTravel": 0,
  "margeBrute": 0,
  "tauxMarge": 0,
  "coutReel": 0,
  "dureeJours": 1,
  "distanceKm": 0
}
\`\`\`

Ensuite le texte complet du devis et l'analyse.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

module.exports = { chat, analyzeImage, generateDevisFromDescription, resetClient };
