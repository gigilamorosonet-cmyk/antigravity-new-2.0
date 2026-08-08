// CLI Tools for Agent Studio
// Intégration des workflows comme dans Claude Code, Opencode, Codex

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Exécute une tâche avec un agent spécifique
 * Comme: claude -p "task" ou opencode run "task"
 */
async function executeTaskWithAgent(agentType, task, options = {}) {
  const {
    maxTurns = 10,
    allowedTools = 'Read,Edit,Bash',
    model = null,
    timeout = 120000
  } = options;

  const startTime = Date.now();

  try {
    let result;
    let command;

    switch (agentType.toLowerCase()) {
      case 'claude':
        command = `claude -p '${task}' --allowedTools '${allowedTools}' --max-turns ${maxTurns}${model ? ` --model ${model}` : ''}`;
        result = execSync(command, { encoding: 'utf8', timeout });
        break;

      case 'opencode':
        command = `opencode run '${task}' --max-turns ${maxTurns}${model ? ` --model ${model}` : ''}`;
        result = execSync(command, { encoding: 'utf8', timeout });
        break;

      case 'codex':
        command = `codex chat -q '${task}' --max-turns ${maxTurns}${model ? ` --model ${model}` : ''}`;
        result = execSync(command, { encoding: 'utf8', timeout });
        break;

      case 'generic' || 'hermes':
        // Utilise l'API locale
        const axios = require('axios');
        result = await axios.post('http://localhost:3000/api/agents/internal-task', {
          task,
          options: { maxTurns, allowedTools, model }
        });
        result = JSON.stringify(result.data);
        break;

      default:
        throw new Error(`Agent type '${agentType}' non supporté`);
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      result: typeof result === 'string' ? JSON.parse(result) || { text: result } : result,
      duration_ms: duration,
      agent: agentType,
      command_executed: command
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration_ms: Date.now() - startTime,
      agent: agentType
    };
  }
}

/**
 * Analyse coûts des opérations
 */
function analyzeCosts(operation, model = 'haiku') {
  const MODEL_COSTS = {
    haiku: { input: 0.00025, output: 0.00125 },
    sonnet: { input: 0.003, output: 0.015 },
    opus: { input: 0.015, output: 0.075 }
  };

  const cost = MODEL_COSTS[model] || MODEL_COSTS.haiku;
  const estimatedTokens = operation.length / 4; // Estimation simple

  return {
    estimated_tokens_input: estimatedTokens,
    estimated_tokens_output: estimatedTokens,
    estimated_cost_usd: estimatedTokens * (cost.input + cost.output),
    recommended_model: 'haiku',
    recommendation: 'Coût minimal est haiku'
  };
}

/**
 * Pipe workflow - exécution séquentielle comme dans Claude Code
 */
async function pipeWorkflow(steps) {
  const results = [];

  for (const step of steps) {
    const { agent, command, depends_on } = step;

    // Vérifier les dépendances
    if (depends_on) {
      let depSatisfied = true;
      for (const dep of depends_on) {
        const depResult = results.find(r => r.step === dep);
        if (!depResult || !depResult.success) {
          depSatisfied = false;
          break;
        }
      }

      if (!depSatisfied) {
        results.push({ step: step.id, success: false, error: 'Prérequis non satisfait' });
        continue;
      }
    }

    // Exécuter la commande
    try {
      let result;

      if (command.startsWith('shell:')) {
        const shellCmd = command.replace('shell:', '');
        result = execSync(shellCmd, { encoding: 'utf8', timeout: 30000 });
        results.push({ step: step.id, success: true, result });
      } else {
        // Utiliser l'agent pour exécuter
        const taskResult = await executeTaskWithAgent(agent, command);
        results.push({ ...taskResult, step: step.id });
      }

    } catch (error) {
      results.push({ step: step.id, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Template pour créer un fichier de contexte léger
 */
function createLightContext() {
  const lightContext = {
    identity: '# Agent Studio Assistant\nEfficiency-focused AI agent for workspace management.',
    rules: [
      'Load only essential context from SOUL.md and USER.md',
      'Use memory_search() on demand for prior context',
      'Default to Haiku model, escalate to Sonnet for complex tasks',
      'Estimate costs before expensive operations',
      'Batch similar operations'
    ]
  };

  return lightContext;
}

module.exports = {
  executeTaskWithAgent,
  analyzeCosts,
  pipeWorkflow,
  createLightContext
};