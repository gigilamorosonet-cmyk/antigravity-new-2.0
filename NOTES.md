# Agent Studio - Mémoire Personnelle
## Agent-001
### Date: 2026-08-07

### Objectif
Créer un site web complet pour gérer et connecter des agents IA, avec:
- Interface visuelle moderne inspirée de Hermes Workspace / Codex / Claude Code
- Système de mémoire dual (individuelle + partagée)
- Workflows n8n et Obsidian intégrés
- Communication entre agents via webhooks
- Gestion dynamique des tâches

### Architecture du Projet
```
/opt/data/agent-studio/
├── server/              # Backend Node.js/Express
│   ├── memory/          # Système de mémoire
│   │   ├── IndividualMemory.js    # Mémoire individuelle par agent
│   │   ├── SharedMemory.js        # Mémoire partagée entre agents
│   │   └── MemoryCoordinator.js   # Coordination mémoire
│   ├── agents/          # Gestion des agents
│   │   ├── AgentManager.js
│   │   ├── AgentTypes/
│   │   └── Communication/
│   ├── workflows/       # Intégration n8n/Obsidian
│   │   ├── N8nWorkflow.js
│   │   ├── ObsidianWorkflow.js
│   │   └── WorkflowEngine.js
│   ├── routes/          # API routes
│   └── config/          # Configuration
├── client/              # Frontend React/Vite
│   ├── components/
│   ├── hooks/
│   ├── pages/
│   └── styles/
└── data/                # Données persistantes
    ├── memory.db        # SQLite pour mémoire
    ├── agents.db        # Base agents
    └── workflows.db     # Workflows n8n/Obsidian
```

### Mémoire Individuelle vs Partagée

#### Mémoire Individuelle (Per-Agent)
- Stockée dans `/opt/data/profiles/<agent-name>/memories/`
- Propriétaire exclusif
- Pas accessible sans permission explicite
- Format: YAML/JSON + fichiers

#### Mémoire Partagée (Cross-Agent)
- Stockée dans `/opt/data/profiles/shared/`
- Accessible par tous les agents connectés
- Nécessite permissions explicites
- Utilise SQLite pour requêtes rapides

### Plan d'Implémentation
1. ✅ Créer structure de base (package.json)
2. ⏳ Créer serveur Express avec Socket.io
3. ⏳ Implémenter système mémoire SQLite
4. ⏳ Créer API routes pour agents
5. ⏳ Implémenter communication webhook
6. ⏳ Créer frontend React
7. ⏳ Intégrer workflows n8n
8. ⏳ Intégrer workflows Obsidian
9. ⏳ Tests et déploiement

### Décision Techniques
- Backend: Node.js + Express (déjà disponible)
- Frontend: React + Vite (rapide, moderne)
- Mémoire: SQLite (léger, embarqué)
- Communication: Socket.io (temps réel) + Webhooks (agents externes)
- Attribution: Tailwind CSS (design moderne)