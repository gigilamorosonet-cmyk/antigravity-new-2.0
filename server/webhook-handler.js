// Webhook Handler - Communication temps réel entre agents
// Basé sur: hermes-agent/SKILL.md - webhooks.md

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

/**
 * Vérifie la signature HMAC d'un webhook
 * @param {object} req - L'objet request Express
 * @param {string} secret - Le secret partagé
 * @returns {boolean} - Vrai si la signature est valide
 */
function verifyWebhookSignature(req, secret) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;
  
  const payload = JSON.stringify(req.body);
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Route les tâches aux agents appropriés
 * @param {string} task_type - Type de tâche
 * @param {object} data - Données de la tâche
 */
function routeTask(task_type, data) {
  const routes = {
    'code_analysis': ['claude', 'opencode'],
    'security_review': ['claude', 'codex'],
    'workflow_execute': ['all'],
    'memory_sync': ['all'],
    'notification': ['discord', 'telegram']
  };
  
  return routes[task_type] || ['default'];
}

/**
 * Enregistre les métriques de tâche
 * @param {object} task - Les détails de la tâche
 * @param {string} status - Statut de la tâche
 */
function recordTaskMetrics(task, status) {
  const statsFile = path.join(__dirname, '../data/task_metrics.json');
  
  let stats = [];
  if (fs.existsSync(statsFile)) {
    stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
  }
  
  stats.push({
    timestamp: new Date().toISOString(),
    task_id: task.id,
    task_type: task.type,
    agent: task.agent,
    status: status,
    tokens_used: task.tokens || 0,
    cost_usd: task.cost || 0
  });
  
  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
}

/**
 * Rate limiter simple par IP
 */
const rateLimiter = new Map();
const RATE_LIMIT = {
  WINDOW_MS: 60000, // 1 minute
  MAX_REQUESTS: 10  // max 10 requêtes par minute
};

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimiter.get(ip) || [];
  
  // Nettoyer les anciennes requêtes
  const recentRequests = userRequests.filter(
    timestamp => now - timestamp < RATE_LIMIT.WINDOW_MS
  );
  
  if (recentRequests.length >= RATE_LIMIT.MAX_REQUESTS) {
    return false; // Rate limit dépassé
  }
  
  recentRequests.push(now);
  rateLimiter.set(ip, recentRequests);
  return true;
}

module.exports = {
  verifyWebhookSignature,
  routeTask,
  recordTaskMetrics,
  checkRateLimit
};