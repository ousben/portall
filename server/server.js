// portall/server/server.js

// Import des modules nécessaires
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

// Import de la configuration de la base de données
const { testConnection, sequelize } = require('./config/database.connection');
const models = require('./models');

// Import des routes
const authRoutes = require('./routes/auth');
const referenceRoutes = require('./routes/reference');
const adminRoutes = require('./routes/admin');
// NOUVEAUX : Routes dashboard utilisateurs
const playerRoutes = require('./routes/players');
const coachRoutes = require('./routes/coaches');

// Création de l'application Express
const app = express();

// Configuration du port
const PORT = process.env.PORT || 5001;

// Middleware de sécurité
app.use(helmet());

// Middleware CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse le JSON dans le body des requêtes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========================
// ROUTES DE L'APPLICATION
// ========================

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Routes des données de référence
app.use('/api/reference', referenceRoutes);

// Routes de l'administrateur
app.use('/api/admin', adminRoutes);

// NOUVEAUX : Routes dashboard utilisateurs
app.use('/api/players', playerRoutes);
app.use('/api/coaches', coachRoutes);

// NOUVEAU : Routes de test pour les emails (uniquement en développement)
if (process.env.NODE_ENV === 'development') {
  console.log('🧪 Loading test email routes for development');
  const testEmailRoutes = require('./routes/test-email');
  app.use('/api/test/email', testEmailRoutes);
  console.log('✅ Test email routes loaded at /api/test/email');
}

// Route de santé générale mise à jour
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Portall API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'Connected',
    services: {
      auth: '/api/auth/health',
      reference: '/api/reference/health',
      admin: '/api/admin/health',
      players: '/api/players/health',  // NOUVEAU
      coaches: '/api/coaches/health',  // NOUVEAU
      database: 'Connected',
      ...(process.env.NODE_ENV === 'development' && {
        emailTest: '/api/test/email/health'
      })
    }
  });
});

// Route de test pour la base de données
app.get('/api/db-test', async (req, res) => {
  try {
    const userCount = await models.User.count();
    const playerCount = await models.PlayerProfile.count();
    const coachCount = await models.CoachProfile.count();
    const njcaaCollegeCount = await models.NJCAACollege.count();
    const ncaaCollegeCount = await models.NCAACollege.count();
    
    res.json({
      status: 'success',
      message: 'Database connection working',
      statistics: {
        users: userCount,
        players: playerCount,
        coaches: coachCount,
        njcaaColleges: njcaaCollegeCount,
        ncaaColleges: ncaaCollegeCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database error',
      error: error.message
    });
  }
});

// Route de base avec informations sur l'API - VERSION MISE À JOUR
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Portall API',
    version: '1.3.0', // Version mise à jour pour Phase 3 complète
    documentation: 'Coming soon',
    phase: 'Phase 3 - User Management (Dashboard Routes Complete)',
    endpoints: {
      health: '/api/health',
      dbTest: '/api/db-test',
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
      },
      reference: {
        base: '/api/reference',
        health: '/api/reference/health',
        njcaaColleges: 'GET /api/reference/njcaa-colleges',
        ncaaColleges: 'GET /api/reference/ncaa-colleges',
        ncaaCollegesByDivision: 'GET /api/reference/ncaa-colleges/:division',
        admin: {
          createNJCAACollege: 'POST /api/reference/njcaa-colleges',
          updateNJCAACollege: 'PUT /api/reference/njcaa-colleges/:id',
          createNCAACollege: 'POST /api/reference/ncaa-colleges'
        }
      },
      admin: {
        base: '/api/admin',
        health: '/api/admin/health',
        dashboard: 'GET /api/admin/dashboard',
        pendingUsers: 'GET /api/admin/users/pending',
        userDetails: 'GET /api/admin/users/:userId',
        approveUser: 'POST /api/admin/users/:userId/approve',
        rejectUser: 'POST /api/admin/users/:userId/reject',
        auditLog: 'GET /api/admin/audit/actions'
      },
      // NOUVEAUX : Endpoints dashboard utilisateurs
      players: {
        base: '/api/players',
        health: '/api/players/health',
        dashboard: 'GET /api/players/dashboard',
        profile: 'GET /api/players/:playerId/profile',
        analytics: 'GET /api/players/analytics',
        updateProfile: 'PUT /api/players/profile',
        toggleVisibility: 'POST /api/players/profile/visibility',
        search: 'GET /api/players/search',
        recordView: 'POST /api/players/:playerId/view'
      },
      coaches: {
        base: '/api/coaches',
        health: '/api/coaches/health',
        dashboard: 'GET /api/coaches/dashboard',
        profile: 'GET /api/coaches/:coachId/profile',
        analytics: 'GET /api/coaches/analytics',
        updateProfile: 'PUT /api/coaches/profile',
        favorites: 'GET /api/coaches/favorites',
        addFavorite: 'POST /api/coaches/favorites/:playerId',
        removeFavorite: 'DELETE /api/coaches/favorites/:playerId',
        updateFavorite: 'PUT /api/coaches/favorites/:playerId',
        savedSearches: 'GET /api/coaches/saved-searches',
        saveSearch: 'POST /api/coaches/saved-searches',
        deleteSearch: 'DELETE /api/coaches/saved-searches/:searchId'
      },
      ...(process.env.NODE_ENV === 'development' && {
        testing: {
          emailHealth: '/api/test/email/health',
          emailTest: '/api/test/email/send-test',
          emailTemplates: '/api/test/email/templates'
        }
      })
    }
  });
});

// Middleware de gestion d'erreur global
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  
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
    if (process.env.NODE_ENV !== 'production') {
      try {
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
      console.log(`📚 Reference endpoints available at http://localhost:${PORT}/api/reference`);
      console.log(`👥 Admin endpoints available at http://localhost:${PORT}/api/admin`);
      // NOUVEAUX logs pour les routes dashboard
      console.log(`👤 Player dashboard endpoints available at http://localhost:${PORT}/api/players`);
      console.log(`🏟️ Coach dashboard endpoints available at http://localhost:${PORT}/api/coaches`);
      console.log(`✅ Phase 3 User Management Dashboard Routes - COMPLETE`);
    });

    //return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// NOUVEAU : Export de l'application pour les tests
module.exports = app;

// Démarrer le serveur seulement si ce fichier est exécuté directement
// (pas quand il est importé par les tests)
if (require.main === module) {
  startServer();
}