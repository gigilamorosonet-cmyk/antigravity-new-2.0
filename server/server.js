const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// === WEBSOCKET SERVER (vanilla WS) ===
const wss = new WebSocket.Server({ server, path: '/ws' });

// Track connected clients + their subscriptions
const wsClients = new Set();
const subscriptions = new Map(); // ws -> Set<channel>

// Broadcast a typed event to all clients (or a specific channel subset)
function broadcast(event, payload = {}) {
  const message = JSON.stringify({ type: event, ...payload, ts: new Date().toISOString() });
  for (const ws of wsClients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    const subs = subscriptions.get(ws);
    // If the client subscribed to relevant channels, or to 'all', send it
    const channels = payload.channel ? [payload.channel] : null;
    if (channels === null || (subs && channels.some(c => subs.has(c) || subs.has('all'))) || !subs) {
      ws.send(message);
    }
  }
}

// Helper: emit agent update
function emitAgentUpdate(agent, action = 'update') {
  broadcast('agent:update', { agent, action, channel: 'agents' });
}

// Helper: emit workflow update
function emitWorkflowUpdate(workflow, action = 'update') {
  broadcast('workflow:update', { workflow, action, channel: 'workflows' });
}

// Helper: emit memory update
function emitMemoryUpdate(key, value, action = 'update') {
  broadcast('memory:update', { key, value, action, channel: 'memory' });
}

// Helper: emit a visual notification flash to all dashboards
function emitNotification(title, message, type = 'info', priority = 'normal') {
  broadcast('notification', { title, message, type, priority, channel: 'notifications' });
}

wss.on('connection', (ws, request) => {
  wsClients.add(ws);
  const subs = new Set(['all']); // default: receive all events
  subscriptions.set(ws, subs);
  console.log('[WebSocket] Client connected — total:', wsClients.size);

  ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected to Agent Studio', ts: new Date().toISOString() }));

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }

    if (data.type === 'subscribe') {
      const arr = new Set(data.channels || []);
      subscriptions.set(ws, arr);
      console.log('[WebSocket] Subscribed channels:', Array.from(arr).join(', '));
    } else if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', ts: new Date().toISOString() }));
    } else if (data.type === 'agent:action') {
      // A client (e.g. 3D House) reported an agent action — rebroadcast as a flash notification
      emitNotification(
        data.title || 'Agent Action',
        data.message || `Agent ${data.agent || '?'} performed an action.`,
        data.type || 'info',
        data.priority || 'normal'
      );
      emitAgentUpdate(data.agent ? { name: data.agent, ...data } : null, 'action');
    } else if (data.type === 'notify') {
      emitNotification(data.title, data.message, data.type, data.priority);
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    subscriptions.delete(ws);
    console.log('[WebSocket] Client disconnected — total:', wsClients.size);
  });

  ws.on('error', (err) => {
    console.warn('[WebSocket] Client error:', err.message);
    wsClients.delete(ws);
    subscriptions.delete(ws);
  });
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Créer le répertoire data si nécessaire
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Fichiers de données
const AGENTS_FILE = path.join(dataDir, 'agents.json');
const MEMORY_FILE = path.join(dataDir, 'memory.json');

// Importer modules avancés
const authService = require('./auth');
const modelRouter = require('./model-router');
const webhookHandler = require('./webhook-handler');
const obsidian = require('./obsidian-integration');
const cliTools = require('./cli-tools');

// === UTILITAIRES ===
function readData(file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { agents: [], tasks: [], users: [] };
  }
}

function writeData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// === ROUTES AUTHENTIFICATION ===
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, api_key } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, mot de passe et nom requis' });
    }

    const result = await authService.register(email, password, name, api_key);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const result = await authService.login(email, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  const user = authService.validateToken(token);
  if (!user) {
    return res.status(403).json({ error: 'Token invalide' });
  }
  
  res.json({ user: authService.getUserById(user.userId) });
});

// === ROUTES AGENTS (avec auth) ===
app.get('/api/agents', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  const data = readData(AGENTS_FILE);
  
  if (!token) {
    // Sans auth: retourner tous les agents publics ou les admin
    return res.json(data.agents.filter(a => !a.owner_id));
  }
  
  const user = authService.validateToken(token);
  if (user) {
    const userAgents = data.agents.filter(a => 
      a.owner_id === user.userId || 
      a.shared_with?.includes(user.userId)
    );
    return res.json(userAgents);
  }
  
  res.json(data.agents.filter(a => !a.owner_id));
});

app.post('/api/agents', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  
  const user = authService.validateToken(token);
  if (!user) {
    return res.status(403).json({ error: 'Token invalide' });
  }
  
  const { name, type, config } = req.body;
  const data = readData(AGENTS_FILE);
  
  if (!name) {
    return res.status(400).json({ error: 'Nom requis' });
  }
  
  const existingAgent = data.agents.find(a => 
    a.name === name && (a.owner_id === user.userId || !a.owner_id)
  );
  
  if (existingAgent) {
    return res.status(400).json({ error: 'Un agent avec ce nom existe déjà' });
  }
  
  const newAgent = {
    id: Date.now(),
    name,
    type: type || 'generic',
    config: config || {},
    status: 'active',
    owner_id: user.userId,
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
    shared_with: []
  };
  
  data.agents.push(newAgent);
  writeData(AGENTS_FILE, data);
  
  emitAgentUpdate(newAgent, 'created');
  emitNotification('Nouvel Agent', `Agent "${newAgent.name}" créé (${newAgent.type})`, 'success');
  
  res.status(201).json({ success: true, id: newAgent.id });
});

app.get('/api/agents/:id', (req, res) => {
  const data = readData(AGENTS_FILE);
  const agent = data.agents.find(a => a.id == req.params.id);
  res.json(agent || null);
});

app.delete('/api/agents/:id', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Authentification requise' });
  
  const user = authService.validateToken(token);
  if (!user) return res.status(403).json({ error: 'Token invalide' });
  
  const data = readData(AGENTS_FILE);
  const agentIndex = data.agents.findIndex(a => a.id == req.params.id);
  
  if (agentIndex === -1) {
    return res.status(404).json({ error: 'Agent non trouvé' });
  }
  
  const agent = data.agents[agentIndex];
  if (agent.owner_id !== user.userId && !user.isAdmin) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  
  data.agents.splice(agentIndex, 1);
  writeData(AGENTS_FILE, data);
  
  emitAgentUpdate({ id: req.params.id, name: agent.name }, 'deleted');
  emitNotification('Agent Supprimé', `Agent "${agent.name}" a été supprimé`, 'warning');
  
  res.json({ success: true });
});

// === ROUTES MÉMOIRE ===
app.get('/api/memory/individual/:agentId', (req, res) => {
  const data = readData(MEMORY_FILE);
  const memory = (data.individual || []).filter(m => m.agent_id === req.params.agentId);
  res.json(memory);
});

app.post('/api/memory/individual/:agentId/:key', (req, res) => {
  const { value } = req.body;
  const data = readData(MEMORY_FILE);
  
  if (!data.individual) data.individual = [];
  
  const existingIndex = data.individual.findIndex(
    m => m.agent_id === req.params.agentId && m.key === req.params.key
  );
  
  const entry = {
    agent_id: req.params.agentId,
    key: req.params.key,
    value,
    updated_at: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    data.individual[existingIndex] = entry;
  } else {
    data.individual.push(entry);
  }
  
  writeData(MEMORY_FILE, data);
  emitMemoryUpdate(req.params.key, value, 'updated');
  res.json({ success: true });
});

app.get('/api/memory/shared', (req, res) => {
  const data = readData(MEMORY_FILE);
  res.json(data.shared || []);
});

app.post('/api/memory/shared/:key', (req, res) => {
  const { value, agentsAllowed } = req.body;
  const data = readData(MEMORY_FILE);
  
  if (!data.shared) data.shared = [];
  
  const existingIndex = data.shared.findIndex(m => m.key === req.params.key);
  
  const entry = {
    key: req.params.key,
    value,
    agents_allowed: agentsAllowed || [],
    updated_at: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    data.shared[existingIndex] = entry;
  } else {
    data.shared.push(entry);
  }
  
  writeData(MEMORY_FILE, data);
  emitMemoryUpdate(req.params.key, value, 'updated');
  emitNotification('Mémoire Partagée', `Clé "${req.params.key}" mise à jour`, 'info');
  res.json({ success: true });
});

// === ROUTES MODEL ROUTING ===
app.post('/api/model/route', (req, res) => {
  const { task, user_role, context } = req.body;
  const routing = modelRouter.routeModel(task, user_role);
  res.json({ 
    ...routing, 
    user_role: user_role || null,
    context_length: context?.length || 0
  });
});

// === ROUTES WEBHOOK ===
app.post('/api/webhooks/:name', (req, res) => {
  try {
    const webhookName = req.params.name;
    const { sender, event, data } = req.body;

    const task = {
      id: Date.now(),
      agent: webhookName,
      type: event,
      data: data,
      sender: sender,
      timestamp: new Date().toISOString()
    };

    webhookHandler.recordTaskMetrics(task, 'received');

    res.json({ 
      success: true, 
      task_id: task.id,
      routed_to: webhookHandler.routeTask(event, data)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === ROUTES WORKFLOWS ===
app.get('/api/workflows/n8n', async (req, res) => {
  const data = readData(MEMORY_FILE);
  res.json(data.n8n || []);
});

app.post('/api/workflows/n8n', async (req, res) => {
  const { name, workflowJson } = req.body;
  const data = readData(MEMORY_FILE);
  
  if (!data.n8n) data.n8n = [];
  
  const newWorkflow = {
    id: Date.now(),
    name,
    workflow_json: workflowJson,
    status: 'draft',
    created_at: new Date().toISOString()
  };
  
  data.n8n.push(newWorkflow);
  writeData(MEMORY_FILE, data);
  
  emitWorkflowUpdate(newWorkflow, 'created');
  emitNotification('Workflow Créé', `Workflow "${newWorkflow.name}" créé`, 'success');
  
  res.status(201).json({ success: true, id: newWorkflow.id });
});

app.get('/api/workflows/n8n/:id', async (req, res) => {
  const data = readData(MEMORY_FILE);
  const workflow = (data.n8n || []).find(w => w.id == req.params.id);
  res.json(workflow || null);
});

app.post('/api/workflows/n8n/:id/execute', async (req, res) => {
  const data = readData(MEMORY_FILE);
  const workflow = (data.n8n || []).find(w => w.id == req.params.id);
  if (workflow) {
    workflow.status = 'active';
    workflow.last_run = new Date().toISOString();
    writeData(MEMORY_FILE, data);
    
    emitWorkflowUpdate(workflow, 'executed');
    emitNotification('Workflow Exécuté', `Workflow "${workflow.name}" est en cours d'exécution`, 'success');
  }
  res.json({ success: true, message: 'Workflow exécuté' });
});

// === ROUTES TELEGRAM PUSH ===
app.post('/api/telegram/push', async (req, res) => {
  try {
    const { message, telegram_id } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message requis' });
    }

    const chatId = telegram_id || process.env.TELEGRAM_CHAT_ID || '8644215373';
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      // Fallback: log to server console (dev mode without bot token)
      console.log(`[Telegram Push] (dev fallback) chat_id=${chatId}: ${message}`);
      emitNotification('Notification Telegram (dev)', message, 'info');
      return res.json({
        success: true,
        dev: true,
        chat_id: chatId,
        message: message,
        note: 'Bot token not configured — message logged to server console only'
      });
    }

    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    };

    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await telegramRes.json();

    if (!telegramRes.ok) {
      throw new Error(result.description || 'Telegram API error');
    }

    res.json({ success: true, telegram: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: ['memory', 'agents', 'workflows', 'model-routing', 'webhooks', 'auth'],
    websocket: {
      status: wsClients.size > 0 ? 'connected' : 'available',
      clients: wsClients.size,
      endpoint: 'wss://' + (req.headers.host || 'localhost:' + PORT) + '/ws'
    }
  });
});

// SERVIR LE FRONTEND
app.use(express.static(path.join(__dirname, '../client')));

// SERVIR LES DASHBOARDS
app.use('/dashboards', express.static(path.join(__dirname, '../dashboards')));

// === ROUTES OBSIDIAN VAULT ===
app.get('/api/obsidian/vault', (req, res) => {
  const vaultPath = path.join(__dirname, '../dashboards/obsidian/vault.json');
  if (fs.existsSync(vaultPath)) {
    const vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
    res.json({ vault });
  } else {
    res.json({ vault: null });
  }
});

app.post('/api/obsidian/vault', (req, res) => {
  const { action, vault } = req.body;
  if (action === 'save' && vault) {
    const vaultPath = path.join(__dirname, '../dashboards/obsidian/vault.json');
    fs.writeFileSync(vaultPath, JSON.stringify(vault, null, 2));
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║        🤖 AGENT STUDIO - Orchestration IA PRO                ║
╠════════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                                    ║
║  API: http://localhost:${PORT}/api                              ║
║  Dashboard: http://localhost:${PORT}/                           ║
║                                                                ║
║  ── Authentification Gratuite ──                             ║
║  ✅ Inscription/Login JWT                                        ║
║  ✅ Protection des routes                                         ║
║  ✅ Multi-tenant (vos agents = vôtres)                            ║
║                                                                ║
║  ── Services Actifs ──                                        ║
║  ✓ Auth (JWT)                                                    ║
║  ✓ Agents (CRUD)                                               ║
║  ✓ Mémoire (individuelle + partagée)                           ║
║  ✓ Workflows n8n                                               ║
║  ✓ Model Router (auto-switch)                                  ║
║  ✓ Webhooks                                                    ║
║  ✓ WebSocket (/ws) — sync en temps réel                      ║
╚════════════════════════════════════════════════════════════════╝
  `);
});