# Guide des Boucles et Graphiques Utilisateurs

## 🎛️ Boucles Automatiques (Loops)

### 1. Loop Population Quotationnelle
**Utilisation:** `hermes loops create`
```yaml
trigger: "24h"
collect_data_from: "site_analytics"
analyze: "visitor_count moyenne_7jours"
action: "notification_telegram"
graph: "population_chart"
```

### 2. Loop Conversion Taux
**Surveillance:** Taux conversion par dispositif mobile/desktop
```yaml
trigger: "1h"
condition: "conversion_rate < 5%"
auto_action: "optimiser_page_accueil"
graph: "conversion_funnel"
```

### 3. Loop Performance Serveur
```yaml
trigger: "5min"
auto_action:
  if_cpu: ">80%" → "scale_up_container"
  if_memory: ">90%" → "restart_service"
graph: "server_dashboard"
```

## 📈 Graphes Interactifs

### Types Disponibles
- **Ligne dynamique** : Temps réel, zoom drag
- **Barres comparatives** : Jour vs jours précédents
- **Heatmap** : Intensité activités sur 24h
- **Funnel** : Parcours conversion visiteur→achat
- **Pie chart** : Répartition budget/utilisation

### Interactions Utiles
- Click : Drill-down détail
- Hover : Info-bulle statistiques
- Drag : Changer période de visualisation
- Double-click : Mode plein écran
- Raccourcis clavier : +/- zoom

## 🛠️ Exemple d'Utilisation Par Utilisateur

**Thomas (Commercial E-commerce):**
```
Commande: "Suivez mes ventes quotidiennes"
Agent création:
- Loop: ventes_journalières
- Graph: CA_hebdomadaire
-Alerte: -10% vs moyenne
```

**Marie (Développeuse):**
```
Commande: "Surveillez mon API"
Agent création:
- Loop: temps_réponse_API
- Graph: performance_réseau
- Achat: seuil 200ms
```

**Julien (Étudiant Coding):**
```
Commande: "Suivez ma progression"
Agent création:
- Loop: heures_codage_jour
- Graph: tâches_accomplies
- Alerte: +20% progression vs objectif
```