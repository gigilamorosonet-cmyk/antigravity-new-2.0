# 🚀 Anti-Gravity 2.0 - Multi-Agent System

**Plateforme complète d'orchestration d'agents IA** avec support natif des modes Étudiant et Codeur, intégration voice, et optimisation tokens (97% de réduction de coûts).

## 📖 Table des Matières

- [✨ Fonctionnalités](#-fonctionnalités)
- [🏗️ Architecture](#-architecture)
- [🚀 Installation](#-installation)
- [🔧 Configuration](#-configuration)
- [📚 API](#-api)
- [👥 Modes de Travail](#-modes-de-travail)
- [🔐 Sécurité](#-sécurité)
- [📊 Statistiques](#-statistiques)
- [🤝 Contributing](#-contributing)

## ✨ Fonctionnalités

### Interface Utilisateur Moderne
- Dashboard 3D avec navigation par étage
- Drag & drop des tâches (React DnD)
- Design cyberpunk avec glassmorphism
- Dark/Light mode

### Système Multi-Agents
- **Agents Hermes** : Assistant généraliste rapide et direct
- **OpenClaw** : Spécialiste des tâches complexes
- **DeepSeek** : Modèle économique pour les tâches simples
- **Mode Étudiant** : Auto-commit, validation hiérarchique
- **Mode Codeur** : Productivité maximale avec supervision

### Mémoire Intelligente
- Mémoire individuelle par agent (isolée)
- Mémoire partagée entre agents
- Injection automatique dans les prompts
- Recherche full-text

### Flux de Travail
- Intégration n8n complète
- Vault Obsidian intégrée
- Workflows personnalisables
- Exécution séquentielle par défaut

### Communication Temps Réel
- WebSocket pour notifications instantanées
- Webhooks d'entrée sortie
- Email integration (IMAP/POP3)
- Inbox intelligente avec traitement automatique

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANTIGRAVITY 2.0 ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│  │   Frontend  │◄───►│  Backend    │◄───►│  Agents     │      │
│  │  React/TS   │     │  FastAPI    │     │  LLM        │      │
│  └─────────────┘     └─────────────┘     └─────────────┘      │
│         │                   │                    │             │
│         ▼                   ▼                    ▼             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│  │ WebSocket   │     │   SQLite    │     │   Redis     │      │
│  │   Realtime  │     │   Storage   │     │   Pub/Sub   │      │
│  └─────────────┘     └─────────────┘     └─────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Éléments Clés

1. **Backend Python (server.py)** - 1226 lignes
   - FastAPI complet avec authentification JWT
   - Chiffrement Fernet pour les clés API
   - WebSocket temps réel
   - Intégration email IMAP
   - Gestion avancée des workflows

2. **Frontend React** - Structure modulaire
   - Composants réutilisables
   - State management avec Zustand
   - Routes protégées
   - Thème responsive

3. **Base de Données** - SQLite
   - Agents, mémoire, activités
   - Clés API chiffrées
   - Workflows et intégrations

## 🚀 Installation

### Prérequis
- Python 3.10+
- Node.js 18+
- pip et uv (gestionnaire de paquets)

### Installation Rapide

```bash
# Cloner le repository
git clone https://github.com/gigilamorosonet-cmyk/antigravity-new-2.0.git
cd antigravity-new-2.0

# Backend Python
pip install -r requirements.txt 2>/dev/null || pip install fastapi uvicorn httpx cryptography
python server.py &

# Frontend React
cd frontend
npm install
npm run dev

# Accéder à l'application
# Frontend: http://localhost:5173
# API: http://localhost:8000
```

### Installation Docker

```bash
# Avec Docker Compose
docker-compose up -d

# Ou construire manuellement
docker build -t antigravity .
docker run -p 8000:8000 -p 5173:5173 antigravity
```

## 🔧 Configuration

### Variables d'Environnement

```bash
# Backend (.env)
ANTIGRAVITY_TOKEN=                      # Token JWT partagé
DATABASE_URL=sqlite:///agentnexus.db       # URL base de données
CORS_ORIGINS=http://localhost:5173       # Origins CORS autorisées

# Frontend (.env)
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

### Configuration des Providers

Les clés API sont chiffrées avec Fernet. Les providers supportés:

| Provider | Modèles Disponibles | Coût/Million |
|----------|---------------------|--------------|
| Anthropic | claude-opus-4, claude-sonnet-4 | $15/$75 |
| OpenAI | gpt-4.1, gpt-4o, o3 | $2/$8 |
| OpenRouter | hermes-4-70b, llama-3.3 | $0.3/$0.8 |
| Mistral | mistral-large | $2/$6 |
| DeepSeek | deepseek-chat, deepseek-reasoner | $0.27/$1.1 |

## 📚 API Endpoints

### Authentification
- `POST /api/auth/register` - Créer un compte
- `POST /api/auth/login` - Se connecter
- `GET /api/auth/me` - Infos utilisateur

### Agents
- `GET /api/agents` - Lister les agents
- `POST /api/agents` - Créer un agent
- `GET /api/agents/:id` - Détails d'un agent
- `PUT /api/agents/:id` - Mettre à jour
- `DELETE /api/agents/:id` - Supprimer

### Mémoire
- `GET /api/memory/individual/:agentId` - Mémoire individuelle
- `POST /api/memory/individual/:agentId/:key` - Sauvegarder
- `GET /api/memory/shared` - Mémoire partagée
- `POST /api/memory/shared/:key` - Sauvegarder partagé

### Chat
- `POST /api/chat` - Conversation
- `POST /api/chat/stream` - Streaming SSE
- `GET /api/messages/:agentId` - Historique

### Routing & Orchestration
- `POST /api/route` - Router les tâches
- `POST /api/judge` - Juger les résultats
- `GET /api/stats` - Statistiques

### Skills
- `GET /api/skills` - Catalogue
- `POST /api/skills` - Ajouter une compétence
- `DELETE /api/skills/:id` - Supprimer

### Workflows
- `GET /api/workflows` - Liste
- `POST /api/workflows` - Créer
- `POST /api/workflows/run-task` - Exécuter
- `GET /api/workflows/:id` - Détails

## 👥 Modes de Travail

### Mode Étudiant (`MODE_ETUDIANT_IDEES.md`)
- Auto-commit avec validation
- Mode sandbox sécurisé
- Feedback en temps réel
- Objectifs pédagogiques

### Mode Codeur (`MODE_CODEUR_IDEES.md`)
- Productivité maximale
- Déploiement VPS intégré
- CI/CD automatisé
- Review de code par superviseurs

### Supervisors
- `@supervisor-cq` - Quality Control
- `@supervisor-devops` - Déploiement & Infrastructure
- `@supervisor-ux` - Interface & Expérience Utilisateur

## 🔐 Sécurité

### Authentification
- JWT (JSON Web Tokens)
- Expiration configurable
- Raffraîchissement automatique

### Protection des Données
- Chiffrement Fernet pour les clés API
- Rate limiting (10 reqs/min/agent)
- Logs anonymisés (pas de clés dans les logs)

### Réseaux
- CORS configuré
- SSL/TLS supporté
- Validation SSL optionnelle

## 📊 Statistiques

Dashboard temps réel avec métriques:

```json
{
  "total": {
    "n": 150,
    "cost": 2.50,
    "tokens": 85000
  },
  "by_agent": [
    {"name": "Hermes Agent", "n": 50, "cost": 0.80, "tokens": 28000}
  ],
  "by_day": [...],
  "by_provider": [...]
}
```

## 🤝 Contributing

1. Fork le repository
2. Créez une branche: `git checkout -b feature/nom-fonctionnalite`
3. Committez: `git commit -m 'Ajout: nom-fonctionnalite'`
4. Push: `git push origin feature/nom-fonctionnalite`
5. Ouvrez une Pull Request

### Conventions
- Commits en français
- Messages clairs et concis
- Code documenté
- Tests inclus pour les nouvelles fonctionnalités

## 📄 License

MIT License - Voir [LICENSE](LICENSE) pour détails.

## 📞 Support

- Issues: [GitHub Issues](https://github.com/gigilamorosonet-cmyk/antigravity-new-2.0/issues)
- Documentation: [Wiki](./docs/)
- Discord: Rejoindre le serveur communautaire

---

**Anti-Gravity 2.0** - Orchestration d'agents IA next-generation