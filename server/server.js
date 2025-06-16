// portall/server/server.js

// Import des modules nécessaires
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Charge les variables d'environnement

// Import de la configuration de la base de données
const { testConnection, sequelize } = require('./config/database.connection');
const models = require('./models');

// Création de l'application Express
const app = express();

// Configuration du port - utilise la variable d'environnement ou 5000 par défaut
const PORT = process.env.PORT || 5001;

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
    environment: process.env.NODE_ENV || 'development',
    database: 'Connected' // Nous pouvons maintenant confirmer cela
  });
});

// Route de test pour la base de données
app.get('/api/db-test', async (req, res) => {
  try {
    // Test simple : compter les utilisateurs
    const userCount = await models.User.count();
    res.json({
      status: 'success',
      message: 'Database connection working',
      userCount
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database error',
      error: error.message
    });
  }
});

// Route de base
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Portall API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      dbTest: '/api/db-test',
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

// Fonction pour démarrer le serveur
const startServer = async () => {
  try {
    // Tester la connexion à la base de données
    await testConnection();
    
    // Synchroniser les modèles avec la base de données
    // En production, utilise les migrations au lieu de sync
    if (process.env.NODE_ENV !== 'production') {
      // En développement, on peut utiliser sync pour simplifier
      // Mais seulement si les migrations ont été exécutées au moins une fois
      try {
        // Vérifier si la table users existe
        await sequelize.getQueryInterface().describeTable('users');
        console.log('📊 Database tables already exist');
      } catch (error) {
        console.log('📊 Running database sync for development...');
        await sequelize.sync({ force: false, alter: true });
        console.log('📊 Database models synchronized');
      }
    }
    
    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Démarrer l'application
startServer();