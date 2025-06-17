// portall/server/server.js

// Import des modules nécessaires
const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // Nouveau : sécurité des headers HTTP
const path = require('path');
require('dotenv').config(); // Charge les variables d'environnement

// Import de la configuration de la base de données
const { testConnection, sequelize } = require('./config/database.connection');
const models = require('./models');

// Import des routes
const authRoutes = require('./routes/auth'); // Nouvelle ligne

// Création de l'application Express
const app = express();

// Configuration du port - utilise la variable d'environnement ou 5000 par défaut
const PORT = process.env.PORT || 5001;

// **MIDDLEWARE DE SÉCURITÉ**
// Helmet ajoute des headers de sécurité automatiquement
app.use(helmet());

// Middleware
// CORS permet à notre frontend (port 3000) de communiquer avec notre backend (port 5000)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true, // Permet l'envoi de cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse le JSON dans le body des requêtes
app.use(express.json({ limit: '10mb' })); // Limite la taille des requêtes

// Parse les données de formulaire URL-encoded
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes d'authentification - NOUVELLE SECTION
app.use('/api/auth', authRoutes);

// Route de santé générale - permet de vérifier que l'API fonctionne
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Portall API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'Connected',
    services: {
      auth: '/api/auth/health',
      database: 'Connected'
    }
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

// Route de base avec informations sur l'API
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Portall API',
    version: '1.0.0',
    documentation: 'Coming soon',
    endpoints: {
      health: '/api/health',
      auth: {
        base: '/api/auth',
        health: '/api/auth/health',
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me',
        forgotPassword: 'POST /api/auth/forgot-password',
        resetPassword: 'POST /api/auth/reset-password'
      }
    }
  });
});

// **MIDDLEWARE DE GESTION D'ERREUR GLOBAL**
// Ce middleware attrape toutes les erreurs non gérées
// Ce middleware doit être défini en dernier
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  
  // Ne pas exposer les détails d'erreur en production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    ...(isDevelopment && { 
      stack: err.stack,
      details: err 
    })
  });
});

// Middleware pour les routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: '/'
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
      console.log(`🔐 Auth endpoints available at http://localhost:${PORT}/api/auth`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Démarrer l'application
startServer();