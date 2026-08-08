# Mémoire Globale Agent Studio

## Configuration Remarquée

Le projet Agent Studio a été créé avec succès avec les fonctionnalités suivantes:

### Architecture Réussie
- Interface web complète avec HTML/CSS/JS pur (pas besoin de React/Vite complexe)
- Serveur Express avec routes API REST
- Gestion de mémoire individuelle et partagée
- Workflows n8n intégrés
- Dashboard inspiré de Hermes Workspace

### Fichiers Créés
1. `/opt/data/agent-studio/` - Répertoire racine
2. `/opt/data/agent-studio/server/server.js` - Serveur principal
3. `/opt/data/agent-studio/client/index.html` - Interface web
4. `/opt/data/agent-studio/data/` - Répertoire des données
5. `/opt/data/agent-studio/package.json` - Dépendances
6. `/opt/data/agent-studio/README.md` - Documentation
7. `/opt/data/agent-studio/index.js` - Point d'entrée

### APIs Fonctionnelles
- `/api/agents` - Gestion des agents
- `/api/memory/individual/:agentId` - Mémoire individuelle
- `/api/memory/shared` - Mémoire partagée
- `/api/workflows/n8n` - Workflows n8n

### Mémoire Individuelle vs Partagée
- **Individuelle**: Chaque agent a son propre espace mémoire
- **Partagée**: Données communes accessibles à tous les agents

### Stack Technique
- Backend: Node.js + Express
- Frontend: HTML5 + CSS3 + Vanilla JS
- Data: JSON files embarqués
- Communication: CORS + API REST

### Lancement
```bash
cd /opt/data/agent-studio
npm start
# Accéder à http://localhost:3000
```

### Dashboard Actif
- serveur tourne sur le port 3000
- 2 agents créés: Claude-Code-AI, OpenCode-Agent
- Mémoire partagée configurée avec "project-context"
- Workflows n8n testés et fonctionnels