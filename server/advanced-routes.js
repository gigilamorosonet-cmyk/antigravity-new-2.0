// Additional Routes for Agent Studio
// Ajouter ces routes au serveur existant

// Importer les modules
const modelRouter = require('./model-router');
const webhookHandler = require('./webhook-handler');
const obsidian = require('./obsidian-integration');
const cliTools = require('./cli-tools');

/**
 * Routes à ajouter au serveur Express
 */
module.exports = function addAdvancedRoutes(app, AGENTS_FILE, MEMORY_FILE) {
  const { readData, writeData } = {
    readData,
    writeData
  };

  // === ROUTES MODELE ROUTING ===
  app.post('/api/model/route', async (req, res) => {
    const { task, user_role, context } = req.body;
    const routing = modelRouter.routeModel(task, user_role);
    res.json({ 
      ...routing, 
      user_role: user_role || null,
      context_length: context?.length || 0
    });
  });

  // === ROUTES WEBHOOK ===
  app.post('/api/webhooks/:name', async (req, res) => {
    try {
      // Vérifier la signature si secret configuré
      const secret = process.env.WEBHOOK_SECRET;
      if (secret && !webhookHandler.verifyWebhookSignature(req, secret)) {
        return res.status(401).json({ error: 'Signature invalide' });
      }

      const webhookName = req.params.name;
      const { sender, event, data } = req.body;

      // Route la tâche selon le type
      const task = {
        id: Date.now(),
        agent: webhookName,
        type: event,
        data: data,
        sender: sender,
        timestamp: new Date().toISOString()
      };

      // Enregistrer la métrique
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

  // === ROUTES OBSDIAN ===
  app.post('/api/obsidian/note', async (req, res) => {
    try {
      const { path: notePath, content, frontmatter } = req.body;
      const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '/opt/data/agent-studio/vault';
      
      // Créer le dossier vault si nécessaire
      obsidian.initializeVault(vaultPath);
      
      const fullPath = obsidian.createNote(vaultPath, notePath, content, frontmatter);
      res.status(201).json({ success: true, path: fullPath });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/obsidian/search', async (req, res) => {
    try {
      const { q } = req.query;
      const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '/opt/data/agent-studio/vault';
      const results = obsidian.searchNotes(vaultPath, q);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // === ROUTES CLI/AGENT EXECUTION ===
  app.post('/api/agents/:id/execute', async (req, res) => {
    try {
      const { task, options } = req.body;
      
      // Récupérer les infos de l'agent
      const data = readData(AGENTS_FILE);
      const agent = data.agents.find(a => a.id == req.params.id);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent non trouvé' });
      }

      // Exécuter la tâche
      const result = await cliTools.executeTaskWithAgent(
        agent.type, 
        task, 
        options
      );

      // Mettre à jour le statut
      if (result.success) {
        const taskResult = {
          id: Date.now(),
          agent_id: req.params.id,
          task,
          status: 'completed',
          result: result.result,
          duration_ms: result.duration_ms,
          model_used: agent.type,
          created_at: new Date().toISOString()
        };
        
        data.tasks = data.tasks || [];
        data.tasks.push(taskResult);
        writeData(AGENTS_FILE, data);
      }

      res.json(result);

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // === ROUTES METRICS ===
  app.get('/api/metrics/agent-performance', async (req, res) => {
    try {
      const { agentId, period = '24h' } = req.query;
      const data = readData(AGENTS_FILE);
      
      const agentTasks = data.tasks?.filter(t => 
        agentId ? t.agent_id == agentId : true
      ) || [];

      const stats = agentTasks.reduce((acc, task) => {
        acc.total_tasks = (acc.total_tasks || 0) + 1;
        acc.completed_tasks = task.status === 'completed' ? acc.completed_tasks + 1 : acc.completed_tasks;
        acc.failed_tasks = task.status === 'failed' ? acc.failed_tasks + 1 : acc.failed_tasks;
        acc.total_duration = (acc.total_duration || 0) + (task.duration_ms || 0);
        return acc;
      }, {});

      res.json({
        agent_id: agentId || 'all',
        period,
        metrics: {
          total_tasks: stats.total_tasks,
          completed_tasks: stats.completed_tasks,
          failed_tasks: stats.failed_tasks,
          avg_duration_ms: stats.total_tasks ? stats.total_duration / stats.total_tasks : 0,
          budget: modelRouter.getCurrentSpent()
        }
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // === ROUTE PIPED WORKFLOW ===
  app.post('/api/workflows/pipe', async (req, res) => {
    try {
      const { steps, parallel = false } = req.body;
      
      if (parallel) {
        // Exécuter les étapes en parallèle
        const results = await Promise.all(
          steps.map(step => cliTools.executeTaskWithAgent(step.agent, step.command, step.options))
        );
        res.json({ success: true, results });
      } else {
        // Exécuter séquentiellement
        const results = await cliTools.pipeWorkflow(steps);
        res.json({ success: true, results });
      }

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // === ROUTE COST ANALYSIS ===
  app.post('/api/analysis/costs', async (req, res) => {
    try {
      const { operation, model } = req.body;
      const analysis = cliTools.analyzeCosts(operation, model);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('✅ Routes avancées chargées:');
  console.log('  - POST /api/model/route');
  console.log('  - POST /api/webhooks/:name');
  console.log('  - POST /api/obsidian/note');
  console.log('  - GET /api/obsidian/search');
  console.log('  - POST /api/agents/:id/execute');
  console.log('  - GET /api/metrics/agent-performance');
  console.log('  - POST /api/workflows/pipe');
  console.log('  - POST /api/analysis/costs');
};

// Variables globales utiles
const readData = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { agents: [], tasks: [] };
  }
};

const writeData = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};