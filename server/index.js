const { app, server } = require('./server');

const PORT = process.env.PORT || 3000;

// Créer les dossiers nécessaires
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

server.listen(PORT, () => {
  console.log(`
========================================
  🤖 Agent Studio Server Démarré
========================================
  Port: ${PORT}
  API: http://localhost:${PORT}/api
  Health: http://localhost:${PORT}/health
  
  Mémoire: ${dataDir}/memory.db
  Agents: ${dataDir}/agents.db
  Workflows: ${dataDir}/workflows.db
  
  ── Endpoints ──
  GET  /api/agents        - Lister les agents
  POST /api/agents        - Créer un agent
  GET  /api/agents/:id    - Détails d'un agent
  POST /api/agents/:id/task - Envoyer une tâche
  
  GET  /api/memory/individual/:agentId - Mémoire individuelle
  POST /api/memory/individual/:agentId/:key - Sauvegarder mémoire
  
  GET  /api/memory/shared - Mémoire partagée
  POST /api/memory/shared/:key - Sauvegarder mémoire partagée
  
  GET  /api/workflows/n8n  - Workflows n8n
  POST /api/workflows/n8n  - Créer un workflow
  POST /api/workflows/n8n/:id/execute - Exécuter un workflow
========================================
  `);
});

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  console.log('Arrêt du serveur...');
  server.close(() => {
    console.log('Serveur arrêté');
    process.exit(0);
  });
});

module.exports = { app, server };