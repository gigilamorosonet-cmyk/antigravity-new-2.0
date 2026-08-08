# Plan d'Optimisation Ca de l'Agent

## 🚀 Contexte
Agent Studio multi-tenant pour orchestration IA avec budget limité

## 📊 Stratégie de Réduction Coûts 97%

### Optimisation Model Routing
- **Haiku Model** : Gratuit (Ollama/LLM Studio)
- **GPT-4** : Payant (OpenAI) - Usage ciblé
- **Gemini Flash** : Alternative gratuite
- **Route intelligente** : Dommy→Haiku→GPT-4→Gemini selon complexité

### Astuces Spécifiques
1. **Prompt Caching** : Messages récurrents en cache
2. **Session Context Limit** : 8KB max vs 50KB par défaut
3. **Free Ollama Heartbeat** : Ping gratuit toutes les 24h
4. **Budget Controls** : Stop automatique dépassement quota

## 🔧 Configuration Recommandée

```bash
# Installation token-optimizer
hermes skills install token-optimizer

# Configuration
hermes config set routing_strategy "haiku-first"
hermes config set max_context 8192  # 8KB
hermes config set free_heartbeat true
hermes config set budget_alert 10.00  # USD
```

## 📈 Métriques à Surveiller
- Coût message (USD)
- Temps réponse
- Quality score (0-100)
- Tokens utilisés

## 🆘 Actions d'Urgence
- `hermes tokens optimize` - Limite stricte
- `hermes fallback haiku` - Mode économie
- `hermes status cost` - Aperçu coûts actuels