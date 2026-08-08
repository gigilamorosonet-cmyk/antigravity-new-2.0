// Model Router - Auto-switching de modèle pour économiser les tokens
// Basé sur les règles de Token Optimizer
// SUPPORT MULTILINGUE: FR, EN, ES, DE

const MODEL_COSTS = {
  haiku: { input: 0.00025, output: 0.00125 },
  sonnet: { input: 0.003, output: 0.015 },
  opus: { input: 0.015, output: 0.075 }
};

// Déclencheurs multilingues
const TRIGGERS = {
  // Mots-clés pour Sonnet (FR/EN)
  sonnet: [
    // Français
    'sécurité', 'vulnérabilité', 'audit', 'architecture', 'débogage', 'erreur',
    'production', 'déploiement', 'revue', 'code', 'complexe', 'résolution',
    'analyse', 'examen', 'revoir', 'modifier', 'configurer', 'déployer',
    // Anglais
    'security', 'vulnerability', 'audit', 'architecture', 'debug', 'error',
    'production', 'deploy', 'review', 'code', 'complex', 'resolve', 'analyze',
    'examine', 'review', 'modify', 'configure', 'deploy', 'instruction',
    'critical'
  ],
  
  // Mots-clés pour Opus (FR/EN)
  opus: [
    // Français
    'critique', 'ursolent', 'prise_de_decision', 'nouveau', 'incertain',
    // Anglais
    'critical', 'high_stakes', 'decision_maker', 'novel', 'unknown'
  ]
};

/**
 * Analyse le texte pour déterminer quel modèle utiliser
 * @param {string} text - Le texte à analyser
 * @param {string} user_role - Rôle de l'utilisateur (optional)
 * @returns {object} - { model: string, reason: string, estimated_cost: number }
 */
function routeModel(text, user_role = null) {
  const text_lower = text.toLowerCase();
  
  // Vérifier les déclencheurs Opus
  for (const trigger of TRIGGERS.opus) {
    if (text_lower.includes(trigger)) {
      return {
        model: 'opus',
        reason: `Détecté déclencheur critique: "${trigger}"`,
        estimated_cost: estimateCost('opus', text.length)
      };
    }
  }
  
  // Vérifier les déclencheurs Sonnet
  for (const trigger of TRIGGERS.sonnet) {
    if (text_lower.includes(trigger)) {
      return {
        model: 'sonnet',
        reason: `Détecté déclencheur complexe: "${trigger}"`,
        estimated_cost: estimateCost('sonnet', text.length)
      };
    }
  }
  
  // Par défaut, Haiku
  return {
    model: 'haiku',
    reason: 'Tâche standard - pas de déclencheurs complexes détectés',
    estimated_cost: estimateCost('haiku', text.length)
  };
}

/**
 * Estime le coût d'une requête
 * @param {string} model - Le modèle à utiliser
 * @param {number} text_length - La longueur du texte
 * @returns {object} - Coût estimé
 */
function estimateCost(model, text_length) {
  const chars_per_token = 4;
  const tokens = Math.ceil(text_length / chars_per_token);
  const cost = MODEL_COSTS[model] || MODEL_COSTS.haiku;
  
  return {
    input: tokens * cost.input,
    output: tokens * cost.output,
    total: tokens * (cost.input + cost.output)
  };
}

/**
 * Récupère le montant dépensé actuellement
 * @returns {number} - Dépense actuelle en USD
 */
function getCurrentSpent() {
  try {
    const fs = require('fs');
    const path = require('path');
    const statsFile = path.join(__dirname, 'data/token_stats.json');
    
    if (fs.existsSync(statsFile)) {
      const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
      return stats.daily_spent || 0;
    }
  } catch (e) {
    return 0;
  }
  return 0;
}

module.exports = { 
  routeModel, 
  estimateCost, 
  getCurrentSpent,
  TRIGGERS,
  MODEL_COSTS
};