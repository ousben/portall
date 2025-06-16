// portall/server/server.js

// Import des modules nécessaires
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Charge les variables d'environnement

// Création de l'application Express
const app = express();

// Configuration du port - utilise la variable d'environnement ou 5000 par défaut
const PORT = process.env.PORT || 5000;

// Middleware
// CORS permet à notre frontend (port 3000) de communiquer avec notre backend (port 5000)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true // Permet l'envoi de cookies
}));

// Parse le JSON dans le body des requêtes
app.use(express.json());

// Parse les données de formulaire URL-encoded
app.use(express.urlencoded({ extended: true }));

// Route de santé - permet de vérifier que l'API fonctionne
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Portall API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Route de base
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Portall API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth (coming soon)',
      users: '/api/users (coming soon)'
    }
  });
});

// Middleware de gestion d'erreur global
// Ce middleware doit être défini en dernier
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});