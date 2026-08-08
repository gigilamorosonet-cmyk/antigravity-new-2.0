# Agent Studio - Orchestration d'Agents IA

Site web complet pour gérer, connecter et orchertrer des agents IA avec interface moderne inspirée de Hermes Workspace / Codex / Claude Code.

## 🚀 Démarrage

```bash
cd /opt/data/agent-studio
npm install
npm start
```

Le serveur démarre sur http://localhost:3000

## 📊 Architecture

### Système de Mémoire

**Mémoire Individuelle** (`mémoire propre à chaque agent`):
- Chaque agent a son propre espace mémoire
- Accessible via `/api/memory/individual/:agentId`
- Données stockées dans `data/memory.json`

**Mémoire Partagée** (`mémoire commune entre agents`):
- Accessible par tous les agents connectés
- Stockée dans `data/memory.json`
- Possède une liste d'agents autorisés

### Workflows n8n

Intégration complète de workflows n8n:
- **Liste**: `GET /api/workflows/n8n`
- **Créer**: `POST /api/workflows/n8n`
- **Exécuter**: `POST /api/workflows/n8n/:id/execute`
- **Détails**: `GET /api/workflows/n8n/:id`

### Workflows Obsidian

Similaire à Obsidian:
- Notes stockées dans une vault
- Structure hiérarchique des dossiers
- Recherche full-text

## 🔌 API Endpoints

### Agents
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/agents | Lister tous les agents |
| POST | /api/agents | Créer un agent |
| GET | /api/agents/:id | Détails d'un agent |
| DELETE | /api/agents/:id | Supprimer un agent |
| POST | /api/agents/:id/task | Envoyer une tâche |

### Mémoire
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/memory/individual/:agentId | Mémoire individuelle |
| POST | /api/memory/individual/:agentId/:key | Sauvegarder mémoire |
| GET | /api/memory/shared | Mémoire partagée |
| POST | /api/memory/shared/:key | Sauvegarder mémoire partagée |

### Workflows
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/workflows/n8n | Liste des workflows |
| POST | /api/workflows/n8n | Créer un workflow |
| POST | /api/workflows/n8n/:id/execute | Exécuter un workflow |

## 🎨 Interface

L'interface ressemble à:
- **Hermes Workspace**: Dashboard avec stats en temps réel
- **Codex**: Gestion de tâches par project
- **Claude Code**: Interface claire et fonctionnelle

### Fonctionnalités
1. 📁 Dashboard avec stats des agents
2. 📝 Gestion des agents (créer, supprimer, connecter)
3. 📂 Mémoire individuelle et partagée
4. ⚡ Workflows n8n intégrés
5. 📚 Vault Obsidian intégré
6. 💬 Communication temps réel via WebSocket

## 🧠 Communication entre Agents

Les agents peuvent communiquer via:
1. **Webhook**: POST `/api/webhook/:agentId`
2. **Socket.io**: Connexion en temps réel
3. **Mémoire partagée**: Accès aux données communes

### Exemple de communication
```javascript
// Envoyer une tâche à un agent
POST /api/agents/1234567890/task
{
  "task": "Analyser ce code",
  "data": { "files": ["server.js"] }
}

// Récupérer la mémoire partagée
GET /api/memory/shared

// Sauvegarder dans la mémoire individuelle
POST /api/memory/individual/1234567890/goal
{ "value": "Objectif de l'agent" }
```

## 🔧 Configuration

Variables d'environnement:
- `PORT`: Port du serveur (défaut: 3000)
- `NODE_ENV`: Environnement (production/development)

## 📁 Structure des Fichiers

```
/opt/data/agent-studio/
├── server/
│   └── server.js          # Serveur Express principal
├── client/
│   └── index.html         # Interface web (HTML/CSS/JS)
├── data/
│   ├── agents.json        # Agents et tâches
│   └── memory.json        # Mémoire individuelle et partagée
├── package.json
├── index.js
└── README.md
```

## 🌟 Fonctionnalités Avancées

### 1. Mémoire individuelle par agent
Chaque agent possède sa mémoire isolée, accessible via son ID.

### 2. Mémoire partagée entre agents
Données accessibles à tous les agents avec permissions.

### 3. Workflow n8n fonctionnel
Exécution complète de workflows n8n avec:
- Nodes définis en JSON
- Exécution séquentielle
- Statut en temps réel

### 4. Dashboard Obsidian-like
- Structure de dossiers
- Notes en Markdown
- Liens bidirectionnels (future)

### 5. Communication temps réel
Socket.io pour:
- Notifications de tâches
- Mises à jour de mémoire
- Statuts des agents

## ✅ Statut

- [x] Interface web fonctionnelle
- [x] API REST complète
- [x] Mémoire individuelle
- [x] Mémoire partagée
- [x] Gestion des agents
- [x] Workflows n8n
- [x] Communication WebSocket
- [ ] Workflow Obsidian complet (en cours)
- [ ] Déploiement production

## 📖 Exemples

### Créer un agent Claude Code
```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Claude-Code-1","type":"claude","config":{"model":"sonnet"}}'
```

### Sauvegarder une pensée
```bash
curl -X POST http://localhost:3000/api/memory/individual/1786130445696/current-goal \
  -H "Content-Type: application/json" \
  -d '{"value":"Analyser le code du projet"}'
```

### Partager un contexte
```bash
curl -X POST http://localhost:3000/api/memory/shared/project-context \
  -H "Content-Type: application/json" \
  -d '{"value":"Studio IA","agentsAllowed":["all"]}'
```