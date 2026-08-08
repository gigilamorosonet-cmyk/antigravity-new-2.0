#!/bin/bash
# Script de démarrage du serveur Agent Studio

cd /opt/data/agent-studio

# Vérifier si node_modules existe
if [ ! -d "node_modules" ]; then
  echo "Installation des dépendances..."
  npm install
fi

# Démarrer le serveur
echo "Démarrage d'Agent Studio..."
npm run dev