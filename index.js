#!/usr/bin/env node
// Point d'entrée du serveur Agent Studio

// Forcer le port
process.env.PORT = '3002';

// Charger le serveur
require('./server/server.js');