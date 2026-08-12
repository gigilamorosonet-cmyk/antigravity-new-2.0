# Agent Studio - Fakecursore (Suivi de projet)

## 📊 Statut Global : EN COURS (Phase 2 & 4 prioritaires)

## 🎯 Objectif
Construire le site de gestion et coopération d'agents IA. Dashboard séparés mais affichables côte à côte. Solo pour l'instant, public plus tard. Authentification laissée transitoire.

## ✅ Phase 2 — Dashboard 3D Maison (COMPLÉTÉE)
**Fichier** : `/opt/data/agent-studio/dashboards/3d-house/index.html`
- Three.js isometric house avec 3 étages
- Étage 1 (Administration) : stats, utilisateurs, paramètres
- Étage 2 (Développement) : agents, workflows n8n, logs
- Étage 3 (Collaboration) : notes Obsidian, chat, feedback
- Navigation par étage interactif
- API intégration : /api/agents, /api/memory/shared
- WebSocket pour mises à jour temps réel
- Thème sombre Nous (purple gradient)
- **Test** : ✅ Serveur démarre, fichier servi sur http://localhost:3002/dashboards/3d-house/index.html

## ✅ Phase 4 — n8n Workflow Dashboard (COMPLÉTÉE)
**Fichier** : `/opt/data/agent-studio/dashboards/n8n/index.html`
- Constructeur drag-drop de workflows visuel
- Palette de nœuds : déclencheurs (cron, webhook, manuel), agents IA (Claude, OpenCode, Codex), actions (mémoire, obsidian, HTTP, condition, transform), notifications (Telegram, Discord)
- Canvas avec connexions visualisées (SVG)
- Éditeur de propriétés par nœud
- Sauvegarde/chargement localStorage
- API intégration : POST /api/workflows/n8n, GET /api/workflows/n8n/:id, POST /api/workflows/n8n/:id/execute
- **Test** : ✅ CRUD workflow fonctionne via curl

## ✅ Dashboard Obsidian Vault (COMPLÉTÉE)
**Fichier** : `/opt/data/agent-studio/dashboards/obsidian/index.html`
- Gestion de vault de notes synchronisées
- Arbre de dossiers navigable
- Éditeur markdown en ligne (marked.js)
- Backlinks + graphique de liens (canvas)
- API intégration : GET/POST /api/obsidian/vault
- **Test** : ✅ API répond `{"vault":null}`

## ✅ Navigation & Intégration Serveur (COMPLÉTÉE)
- Routes ajoutées dans `/opt/data/agent-studio/server/server.js`
  - `GET /dashboards/*` → sert les fichiers HTML statiques
  - `GET /api/obsidian/vault` → charge le vault
  - `POST /api/obsidian/vault` → sauvegarde le vault
- Sidebar client mise à jour avec section "Dashboards" → 3 liens ouvrant chaque dashboard dans un nouvel onglet

## 📁 Structure des dossiers
```
/opt/data/agent-studio/
├── dashboards/
│   ├── 3d-house/index.html      (1316 lignes)
│   ├── n8n/index.html           (745 lignes)
│   └── obsidian/index.html      (480+ lignes)
├── server/
│   ├── server.js                (modifié: +3 routes dashboard/obsidian)
│   ├── auth.js                  (existant: JWT + crypto)
│   ├── model-router.js          (existant: auto-switch haiku/sonnet/opus)
│   ├── obsidian-integration.js  (existant)
│   └── ...
└── client/index.html            (modifié: sidebar avec navigation dashboards)
```

## 📋 Phases suivantes (à définir)
- Phase 1 : Auth OAuth2 (GitHub, Google)
- Phase 3 : Interface React/Vite modernisée
- Phase 5 : Mode Étudiant & Mode Codeur
- Phase 6 : Déploiement public + Docker
- Phase 7 : Système de superviseurs (@supervisor-cq, @supervisor-devops, @supervisor-ux)

## 🔧 Commandes de test
```bash
# Démarrer le serveur
cd /opt/data/agent-studio && node index.js

# Test endpoints
curl http://localhost:3002/health
curl http://localhost:3002/api/agents
curl http://localhost:3002/api/workflows/n8n
curl http://localhost:3002/api/obsidian/vault
```
