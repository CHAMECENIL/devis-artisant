# Devis Artisant

Application SaaS pour artisans du BTP — chiffrage de devis assisté par intelligence artificielle.

## Description

Cette application permet aux artisans de créer, gérer et envoyer des devis professionnels rapidement grâce à l'assistance de l'IA (Claude d'Anthropic). Elle est conçue pour simplifier le processus de chiffrage dans le secteur du BTP.

## Stack technique

- **Backend** : Node.js / Express
- **Base de données** : SQLite (better-sqlite3)
- **IA** : Anthropic Claude API (`@anthropic-ai/sdk`)
- **Email** : Nodemailer
- **PDF** : Puppeteer
- **Autres** : CORS, dotenv, multer, uuid, express-rate-limit

## Prérequis

- Node.js >= 18.0.0
- npm

## Installation

```bash
npm install
```

## Configuration

Créer un fichier `.env` à la racine du projet :

```env
ANTHROPIC_API_KEY=votre_clé_api
PORT=3000
```

## Lancement

```bash
# Production
npm start

# Développement (avec rechargement automatique)
npm run dev
```

## Structure du projet

```
├── backend/
│   ├── server.js        # Point d'entrée de l'application
│   ├── routes/          # Routes API Express
│   ├── services/        # Logique métier et intégration IA
│   └── database/        # Gestion de la base de données SQLite
├── package.json
└── README.md
```
