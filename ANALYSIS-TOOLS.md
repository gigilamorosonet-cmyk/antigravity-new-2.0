# Analysis: Outils pour Agent Studio - Optimisation Modèle & Intégration n8n/Obsidian

## 🎯 Outils Nécessaires pour le Projet Agent Studio

### 1. CHANGEMENT AUTOMATIQUE DE MODÈLE (Model Auto-Switching)

**Basé sur: Token Optimizer - SOUL.md**

**Règles pour Model Selection:**
```
DEFAULT: Always use Haiku (plus cher pour rien)

SWITCH TO SONNET only when:
- Architecture decisions affecting multiple systems
- Production code review (security implications)
- Security analysis or vulnerability assessment
- Complex debugging requiring deep reasoning
- Strategic decisions spanning multiple projects

SWITCH TO OPUS only when:
- Mission-critical decisions with high stakes
- Novel problems with no established patterns
- User explicitly requests highest capability

WHEN IN DOUBT: Try Haiku first. Escalate if results insufficient.
```

**Implémentation dans Agent Studio:**

```javascript
// Configuration model routing JSON
{
  "model_routing": {
    "default": "haiku",
    "switch_triggers": {
      "security_review": "sonnet",
      "architecture": "sonnet", 
      "debugging": "sonnet",
      "production_code": "sonnet",
      "critical_decision": "opus"
    },
    "context_indicators": [
      "security", "vulnerability", "audit",
      "architecture", "design pattern",
      "debug", "error", "crash",
      "production", "deploy", "release"
    ]
  }
}
```

### 2. OUTILS n8n Intégration

**Basé sur: n8n-vs-obsidian-analysis.md**

**Workflow Types pour n8n:**

#### a) Code Analysis Workflow
```json
{
  "name": "Code-Analysis",
  "nodes": [
    {
      "id": "github-trigger",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "analyze-code"
      }
    },
    {
      "id": "parse-files",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "return items.map(item => ({json: {code: item.body}}))}"
      }
    },
    {
      "id": "analyze-with-agent",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "http://localhost:3000/api/agents/claude-task",
        "method": "POST",
        "body": {
          "task": "Analyze this code for security issues and improvements",
          "data": "{{$json}}"
        }
      }
    }
  ]
}
```

#### b) Agent Task Distribution
```json
{
  "name": "Task-Distribution",
  "nodes": [
    {
      "id": "cron",
      "type": "n8n-nodes-base.cron",
      "parameters": {
        "triggerTimes": {"item": [{"mode": "everyX", "value": 30, "unit": "minutes"}]}
      }
    },
    {
      "id": "check-tasks",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "http://localhost:3000/api/tasks/pending"
      }
    },
    {
      "id": "route-task",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "value": "={{ $json.agent_preference }}",
        "rules": {
          "conditions": [
            {"value1": "claude", "operation": "equal"},
            {"value1": "opencode", "operation": "equal"},
            {"value1": "generic", "operation": "equal"}
          ]
        }
      }
    }
  ]
}
```

### 3. OUTILS Obsidian Intégration

**Basé sur: n8n-vs-obsidian-analysis.md**

**Vault Structure pour Obsidian:**
```
agent-vault/
├── 00-Inbox/              # Notes en attente de traitement
├── 01-Projects/          
│   ├── Agent-Studio/      # Notes spécifiques au projet
│   └── Workflows/         # Documentation workflow
├── 02-Archive/            # Notes archivées
├── Templates/             # Modèles pour nouvelles notes
│   ├── Agent-Task.md
│   ├── Code-Analysis.md
│   └── Meeting-Notes.md
└── Tags/                  # Tags organisateurs
    #project, #task, #analysis, #review
```

**Structure JSON pour Obsidian:**
```json
{
  "vault_path": "/opt/data/agent-studio/vault",
  "notes": [
    {
      "path": "01-Projects/Agent-Studio/README.md",
      "frontmatter": {
        "title": "Agent Studio",
        "tags": ["#project", "#workspace"],
        "created": "2026-08-07",
        "status": "active"
      },
      "content": "# Agent Studio\n\n## Overview\n...\n"
    }
  ]
}
```

### 4. OUTILS DE COMUNICATION Agent ↔ Agent

**Basé sur: webhooks.md**

**Webhook Patterns:**

#### Pattern 1: Task Reception
```python
# Script: api/task_handler.py
def handle_incoming_webhook(sender_agent, task_data):
    """
    When a task arrives from another agent via webhook
    """
    # 1. Validate sender
    if not is_trusted_agent(sender_agent):
        raise SecurityError("Unauthorized sender")
    
    # 2. Route to appropriate agent based on type
    if task_data['type'] == 'code_analysis':
        route_to_agent('claude-analysis', task_data)
    elif task_data['type'] == 'memory_sync':
        route_to_agent('memory-manager', task_data)
    
    # 3. Log task in current agent's memory
    save_to_memory(f"task_received_{task_data['id']}", task_data)
```

#### Pattern 2: Result Delivery
```python
# Script: api/delivery.py
def deliver_result(target_agent, result, method='webhook'):
    """
    Deliver results to another agent
    """
    if method == 'webhook':
        webhook_url = get_agent_webhook(target_agent)
        requests.post(webhook_url, json={
            'type': 'task_result',
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
    elif method == 'memory':
        shared_key = f"latest_result_{result['task_id']}"
        update_shared_memory(shared_key, result)
```

### 5. OUTILS D'OPTIMISATION DE TOKENS

**Basé sur: OPTIMIZATION-RULES.md**

**File: `/opt/data/agent-studio/OPTIMIZATION-RULES.md`**

```markdown
# TOKEN OPTIMIZATION RULES FOR AGENT STUDIO

## SESSION INITIALIZATION RULE
On every session start:
1. Load ONLY these files:
   - SOUL.md (this file)
   - USER.md (user context)
   - IDENTITY.md (if exists)

2. DO NOT auto-load:
   - MEMORY.md
   - Session history
   - Prior tool outputs

3. When user asks about prior context:
   - Use memory_search() on demand
   - Pull only relevant snippet with memory_get()

## MODEL SELECTION RULE
DEFAULT: Always use Haiku

SWITCH TO SONNET only when:
- Architecture decisions
- Production code review
- Security analysis
- Complex debugging/reasoning

## DAILY BUDGET: $5 (warning at 75%)
## MONTHLY BUDGET: $100 (warning at 75%)

## COST AWARENESS
Before any operation, consider:
1. Can this be batched with similar operations?
2. Is this the minimum model needed?
3. Am I loading only necessary context?
4. Will this push me over budget limits?
```

### 6. COMPÉTEURS ET MÉTRIQUES

**Implementation pour Agent Studio:**

```javascript
// API Endpoint: /api/metrics/agent-performance
{
  "agent_id": "claude-code-ai",
  "period": "24h",
  "metrics": {
    "total_tasks": 45,
    "completed_tasks": 38,
    "failed_tasks": 2,
    "estimated_tokens_used": 125000,
    "estimated_cost_usd": 1.85,
    "avg_response_time_ms": 842,
    "current_model": "haiku",
    "model_switches": 3
  },
  "budget_status": {
    "daily_budget": 5.00,
    "daily_spent": 1.85,
    "remaining": 3.15,
    "percentage_used": 37.0
  }
}
```

## 📋 Checklist d'Implémentation pour Agent Studio

### À implémenter dans le serveur (server.js): ✅

| Fonctionnalité | Statut | Fichier |
|----------------|--------|---------|
| Model auto-switching | ⏳ À implémenter | /server/model-router.js |
| Webhook handler | ⏳ À implémenter | /server/webhooks.js |
| Agent communication | ✅ En cours | /server/server.js |
| Budget tracking | ⏳ À implémenter | /server/budget.js |
| Obsidian vault sync | ⏳ À implémenter | /server/obsidian.js |
| n8n workflow engine | ⏳ À implémenter | /server/workflows.js |

### À ajouter dans l'interface: ✅

| Composant | Statut | Emplacement |
|-----------|--------|-------------|
| Model indication | ✅ Dashboard | client/index.html |
| Budget display | ✅ Stats grid | client/index.html |
| Task queue | ✅ Agent card | client/index.html |
| Memory view | ⏳ À améliorer | client/index.html |

## 🚀 Prochaines Étapes

1. **Implémenter le router de modèles** basé sur les règles SOUL.md
2. **Ajouter les métriques de coût** dans l'API /api/metrics
3. **Créer les endpoints webhook** pour la communication agent↔agent
4. **Synchroniser avec Obsidian** - importer les notes existantes
5. **Exécuter des workflows n8n** réels via l'UI

---

**Fichiers créés:**
- `/opt/data/agent-studio/OPTIMIZATION-RULES.md`
- `/opt/data/agent-studio/ANALYSIS-TOOLS.md` (ce document)
- Templates pour workflows n8n et structure Obsidian