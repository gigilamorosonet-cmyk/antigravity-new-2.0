# 🚀 Anti-Gravity 2.0 - Multi-Agent System

Plateforme complète d'orchestration d'agents IA avec mode étudiant et mode codeur.

## ✨ Fonctionnalités

### Modes de Travail
- **Mode Étudiant** : Auto-commit, validation hiérarchique, supervision décentralisée
- **Mode Codeur** : Productivité maximale, déploiement VPS, CI/CD intégré
- **Mode Collaboratif** : Supervision par @supervisor-cq, @supervisor-devops, @supervisor-ux

### Architecture Multi-Dashboard
1. **Dashboard Maison 3D** : Vue étager par étage
   - Étage 1 : Administration (stats, paramètres)
   - Étage 2 : Développement (agents, workflows, logs)
   - Étage 3 : Collaboration (notes Obsidian, chat temps réel)

2. **Orchestration Agents**
   - Supervisors : Code Quality, DevOps, UX/UI
   - Apprentices : Frontend, Backend, QA
   - Communication : Webhook WebSocket

### Système de Mémoire
- **Mémoire Individuelle** : Espace mémoire isolé par agent
- **Mémoire Partagée** : Accès commun avec permissions
- **Injection Automatique** : Mémoire injectée dans les prompts

### Workflows & Integrations
- **n8n Integration** : Exécution complète de workflows
- **Obsidian Vault** : Notes hiérarchiques, recherche full-text
- **WebSocket Realtime** : Notifications instantanées
- **Email Integration** : IMAP/POP3 et traitement automatique

## 🛠️ Installation

```bash
# Clonez le repository
git clone https://github.com/gigilamorosonet-cmyk/antigravity-new-2.0.git
cd antigravity-new-2.0

# Backend Python (FastAPI)
pip install -r requirements.txt
python server.py

# Frontend React
cd frontend
npm install
npm run dev

# Ou avec Docker
docker-compose up -d
```

## 🔧 Configuration

### Variables d'Environnement
```bash
# Backend
ANTIGRAVITY_TOKEN=your_jwt_token
DATABASE_URL=sqlite:///agentnexus.db

# Frontend
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

### Providers Supportés
- Anthropic (Claude)
- OpenAI (GPT-4o, o1, o3)
- OpenRouter (Hermes, Llama, etc.)
- Mistral
- DeepSeek
- Google Gemini
- xAI (Grok)
- Custom Endpoints

## 📚 API Endpoints

### Agents
- `GET /api/agents` - Lister les agents
- `POST /api/agents` - Créer un agent
- `GET /api/agents/:id` - Détails d'un agent
- `DELETE /api/agents/:id` - Supprimer un agent

### Mémoire
- `GET /api/memory/individual/:agentId` - Mémoire individuelle
- `POST /api/memory/individual/:agentId/:key` - Sauvegarder mémoire
- `GET /api/memory/shared` - Mémoire partagée
- `POST /api/memory/shared/:key` - Sauvegarder mémoire partagée

### Chat
- `POST /api/chat` - Conversation avec un agent
- `POST /api/chat/stream` - Streaming en temps réel

### Routing
- `POST /api/route` - Router les tâches vers les agents
- `POST /api/judge` - Juge les résultats

### Skills
- `GET /api/skills` - Catalogue des compétences
- `POST /api/skills` - Ajouter une compétence

## 🔐 Sécurité

- JWT Authentication
- Rate Limiting (10 reqs/min/agent)
- Clés API chiffrées (Fernet)
- Logs minimaux (pas de clés)
- SSL/TLS supporté

## 📊 Statistiques

Dashboard en temps réel avec :
- Nombre d'agents actifs
- Coût total des requêtes
- Tokens utilisés
- Temps de réponse
- Stats par provider

## 🎯 Roadmap

- [x] Agent Switcher UI
- [x] Objective Board drag-drop
- [x] Server Config Form
- [ ] WebSocket real-time sync
- [ ] Claude Code/Opencode integration
- [ ] MCP tools bridge

## 🤝 Contributing

1. Fork le repository
2. Créez une branche feature
3. Committez vos changements
4. Ouvrez une Pull Request

## 📄 License

MIT - Voir LICENSE pour plus de détails.

## 🌐 Liens Utiles

- [Documentation](#documentation)
- [API Reference](#api-endpoints)
- [Vue d'ensemble](#architecture-multi-dashboard)