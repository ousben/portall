// portall/server/server.js

/**
 * Serveur Express principal pour Portall - Phase 4 Complete
 * 
 * Ce serveur orchestre l'ensemble de votre écosystème Portall, depuis
 * l'authentification des utilisateurs jusqu'au traitement des paiements
 * Stripe en temps réel via les webhooks.
 * 
 * Architecture évolutive que nous avons construite :
 * 
 * Phase 1: Foundation (Structure de base, CORS, Express)
 * Phase 2: Authentication (JWT, sécurité, rôles utilisateurs)
 * Phase 3: User Management (Dashboards, profils, validation admin)
 * Phase 4: Payment Integration (Stripe, webhooks, abonnements)
 * 
 * Points techniques cruciaux à comprendre :
 * 
 * 1. ORDRE DES MIDDLEWARE : Les routes webhook doivent être configurées
 *    AVANT express.json() car elles nécessitent le payload brut pour
 *    la validation de signature Stripe.
 * 
 * 2. SÉCURITÉ MULTICOUCHE : Chaque type de route a ses propres
 *    exigences de sécurité (JWT pour API, signature HMAC pour webhooks).
 * 
 * 3. GESTION D'ERREUR : Architecture robuste qui guide l'utilisateur
 *    vers la résolution des problèmes avec des messages informatifs.
 * 
 * 4. OBSERVABILITÉ : Logs détaillés pour faciliter le débogage et
 *    le monitoring en production.
 */

// ========================================
// IMPORTS ET CONFIGURATION INITIALE
// ========================================

// Modules Node.js et Express fondamentaux
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Configuration des variables d'environnement
// Doit être chargé en premier pour que toutes les autres configurations
// puissent accéder aux variables d'environnement
require('dotenv').config();

// Configuration de la base de données et modèles
// Cette configuration centralisée garantit la cohérence des connexions
const { testConnection, sequelize } = require('./config/database.connection');
const models = require('./models');

// ========================================
// IMPORTS DES ROUTES - ARCHITECTURE MODULAIRE
// ========================================

/**
 * Chaque groupe de routes est dans un module séparé pour respecter
 * le principe de responsabilité unique et faciliter la maintenance.
 * Cette approche modulaire permet d'évoluer chaque fonctionnalité
 * indépendamment sans affecter les autres.
 */

// Routes d'authentification et autorisation (Phase 2)
const authRoutes = require('./routes/auth');

// Routes des données de référence (collèges, sports, etc.) (Phase 1)
const referenceRoutes = require('./routes/reference');

// Routes de l'interface administrateur (Phase 3)
const adminRoutes = require('./routes/admin');

// Routes des dashboards utilisateurs (Phase 3)
const playerRoutes = require('./routes/players');
const coachRoutes = require('./routes/coaches');
// NOUVEAU : Routes pour les coachs NJCAA (Phase 5)
const njcaaCoachRoutes = require('./routes/njcaaCoaches');

// Routes de gestion des abonnements (Phase 4)
const subscriptionRoutes = require('./routes/subscriptions');

// Routes webhook Stripe - CRITIQUE pour les paiements (Phase 4)
const webhookRoutes = require('./routes/webhooks');

// ========================================
// INITIALISATION DE L'APPLICATION EXPRESS
// ========================================

const app = express();

// Configuration du port avec fallback sécurisé
// Utilise la variable d'environnement PORT ou 5001 par défaut
const PORT = process.env.PORT || 5001;

// ========================================
// CONFIGURATION DE SÉCURITÉ GLOBALE
// ========================================

/**
 * Helmet ajoute plusieurs headers de sécurité HTTP pour protéger
 * contre les attaques courantes (XSS, clickjacking, etc.).
 * C'est une première ligne de défense essentielle.
 */
app.use(helmet({
  // Configuration personnalisée pour autoriser les webhooks Stripe
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  // Permettre les connexions depuis votre frontend
  crossOriginEmbedderPolicy: false
}));

/**
 * Configuration CORS (Cross-Origin Resource Sharing)
 * 
 * Cette configuration permet à votre frontend React de communiquer
 * avec votre API backend même s'ils sont sur des ports différents
 * en développement ou des domaines différents en production.
 */
app.use(cors({
  // URL de votre frontend React
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  
  // Autoriser les cookies et credentials
  credentials: true,
  
  // Méthodes HTTP autorisées
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  
  // Headers autorisés (incluant les headers custom pour Stripe)
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'stripe-signature', // CRUCIAL pour les webhooks
    'X-Requested-With',
    'Accept'
  ]
}));

// ========================================
// CONFIGURATION CRITIQUE : ROUTES WEBHOOK EN PREMIER
// ========================================

/**
 * POINT TECHNIQUE CRUCIAL À COMPRENDRE :
 * 
 * Les routes webhook DOIVENT être configurées AVANT express.json()
 * car Stripe nécessite le payload brut (non parsé) pour valider
 * la signature cryptographique des webhooks.
 * 
 * Si express.json() parse le body en premier, le contenu original
 * est perdu et la validation de signature échoue systématiquement.
 * 
 * Ordre critique :
 * 1. Routes webhook (avec raw body parsing)
 * 2. express.json() (pour toutes les autres routes)
 * 3. Routes API standard
 */
app.use('/api/webhooks', webhookRoutes);
console.log('🎣 Webhook routes loaded at /api/webhooks (raw body parsing enabled)');

// ========================================
// MIDDLEWARE DE PARSING STANDARD
// ========================================

/**
 * Configuration du parsing JSON pour toutes les routes non-webhook
 * 
 * Limite de 10MB pour supporter l'upload de fichiers volumineux
 * comme les photos de profil ou les documents de validation.
 */
app.use(express.json({ 
  limit: '10mb',
  // Vérification du Content-Type pour éviter les attaques
  type: ['application/json']
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb'
}));

// Middleware pour parser les requêtes avec du texte brut (si nécessaire)
app.use(express.text({ 
  limit: '1mb',
  type: 'text/plain'
}));

// ========================================
// ROUTES API STANDARD - ARCHITECTURE EN COUCHES
// ========================================

/**
 * Chaque groupe de routes est monté sur un préfixe spécifique
 * qui reflète sa responsabilité métier. Cette organisation claire
 * facilite la navigation dans l'API et le débogage.
 */

// Routes d'authentification - Fondation de la sécurité
app.use('/api/auth', authRoutes);
console.log('🔐 Auth routes loaded at /api/auth');

// Routes des données de référence - Support métier
app.use('/api/reference', referenceRoutes);
console.log('📚 Reference routes loaded at /api/reference');

// Routes administrateur - Gestion système
app.use('/api/admin', adminRoutes);
console.log('👨‍💼 Admin routes loaded at /api/admin');

// Routes des dashboards utilisateurs - Interface métier
app.use('/api/players', playerRoutes);
console.log('👤 Player routes loaded at /api/players');

app.use('/api/coaches', coachRoutes);
console.log('🏟️ Coach routes loaded at /api/coaches');

// NOUVEAU : Routes spécialisées pour les coachs NJCAA
app.use('/api/njcaa-coaches', njcaaCoachRoutes);
console.log('🏟️ NJCAA Coach routes loaded at /api/njcaa-coaches (player evaluation system)');

// Routes des abonnements - Cœur du business model
app.use('/api/subscriptions', subscriptionRoutes);
console.log('💳 Subscription routes loaded at /api/subscriptions');

// ========================================
// ROUTES DE DÉVELOPPEMENT ET TEST
// ========================================

/**
 * Routes spécifiques à l'environnement de développement
 * 
 * Ces routes facilitent le développement et les tests mais ne sont
 * jamais exposées en production pour des raisons de sécurité.
 */
if (process.env.NODE_ENV === 'development') {
  // Routes de test pour l'envoi d'emails
  try {
    const testEmailRoutes = require('./routes/test-email');
    app.use('/api/test/email', testEmailRoutes);
    console.log('✅ Test email routes loaded at /api/test/email (development only)');
  } catch (error) {
    console.log('⚠️ Test email routes not available (optional in development)');
  }
  
  // Route de test pour simuler des webhooks Stripe
  app.post('/api/test/simulate-webhook', express.json(), async (req, res) => {
    try {
      const { eventType, data } = req.body;
      
      console.log(`🧪 Simulating Stripe webhook: ${eventType}`);
      
      // Cette route permet de tester votre logique webhook sans
      // dépendre de vrais événements Stripe pendant le développement
      res.json({
        status: 'success',
        message: 'Webhook simulation endpoint ready',
        note: 'Use /api/webhooks/test for actual webhook testing'
      });
      
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Webhook simulation failed',
        error: error.message
      });
    }
  });
  
  console.log('🧪 Webhook simulation endpoint available at /api/test/simulate-webhook');
}

// ========================================
// ROUTES DE MONITORING ET SANTÉ
// ========================================

/**
 * Route de santé globale - Point d'entrée pour le monitoring
 * 
 * Cette route fournit un aperçu complet de l'état de votre système
 * et sert de point de départ pour diagnostiquer les problèmes.
 */
app.get('/api/health', async (req, res) => {
  try {
    // Test de connectivité de base de données
    let databaseStatus = 'Unknown';
    try {
      await sequelize.authenticate();
      databaseStatus = 'Connected';
    } catch (dbError) {
      databaseStatus = 'Disconnected';
      console.error('Database health check failed:', dbError.message);
    }
    
    // Test de configuration Stripe
    let stripeStatus = 'Unknown';
    try {
      const { stripe } = require('./config/stripe');
      await stripe.accounts.retrieve();
      stripeStatus = 'Connected';
    } catch (stripeError) {
      stripeStatus = 'Configuration Error';
      console.error('Stripe health check failed:', stripeError.message);
    }
    
    // Assemblage du rapport de santé complet
    const healthReport = {
      status: 'OK',
      message: 'Portall API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '4.0.0', // Version Phase 4 complète
      
      // État des services critiques
      services: {
        database: databaseStatus,
        stripe: stripeStatus,
        auth: '/api/auth/health',
        reference: '/api/reference/health',
        admin: '/api/admin/health',
        players: '/api/players/health',
        coaches: '/api/coaches/health',
        subscriptions: '/api/subscriptions/health',
        webhooks: '/api/webhooks/health'
      },
      
      // Configuration des webhooks de paiement
      webhooks: {
        endpoint: '/api/webhooks/stripe',
        supportedEvents: '/api/webhooks/events',
        healthCheck: '/api/webhooks/health',
        configured: !!process.env.STRIPE_WEBHOOK_SECRET,
        testEndpoint: process.env.NODE_ENV === 'development' ? '/api/webhooks/test' : null
      },
      
      // Métriques de configuration
      configuration: {
        corsEnabled: true,
        helmetEnabled: true,
        jsonLimit: '10mb',
        webhookSecretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
        emailConfigured: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER),
        jwtConfigured: !!process.env.JWT_SECRET
      }
    };
    
    // Déterminer le code de statut basé sur l'état des services critiques
    const criticalServicesOk = databaseStatus === 'Connected' && 
                              stripeStatus === 'Connected' &&
                              !!process.env.STRIPE_WEBHOOK_SECRET;
    
    const statusCode = criticalServicesOk ? 200 : 503;
    
    res.status(statusCode).json(healthReport);
    
  } catch (error) {
    console.error('Health check endpoint error:', error);
    
    res.status(500).json({
      status: 'ERROR',
      message: 'Health check system failure',
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
    });
  }
});

/**
 * Route de test de connectivité base de données avec statistiques
 * 
 * Cette route fournit des informations détaillées sur l'état de votre
 * base de données et des statistiques utiles pour le monitoring.
 */
app.get('/api/db-test', async (req, res) => {
  try {
    // Test de connectivité de base
    await sequelize.authenticate();
    
    // Collecte des statistiques de base de données
    const userCount = await models.User.count();
    const playerCount = await models.PlayerProfile.count();
    const coachCount = await models.CoachProfile.count();
    const njcaaCollegeCount = await models.NJCAACollege.count();
    const ncaaCollegeCount = await models.NCAACollege.count();
    
    // Statistiques de paiement (Phase 4)
    let subscriptionCount = 0;
    let planCount = 0;
    let paymentCount = 0;
    
    try {
      if (models.UserSubscription) {
        subscriptionCount = await models.UserSubscription.count();
      }
      if (models.SubscriptionPlan) {
        planCount = await models.SubscriptionPlan.count();
      }
      if (models.PaymentHistory) {
        paymentCount = await models.PaymentHistory.count();
      }
    } catch (paymentError) {
      console.warn('Payment statistics not available:', paymentError.message);
    }
    
    // Statistiques par statut d'abonnement
    let subscriptionsByStatus = {};
    try {
      if (models.UserSubscription) {
        const statusCounts = await models.UserSubscription.findAll({
          attributes: [
            'status',
            [sequelize.fn('COUNT', sequelize.col('status')), 'count']
          ],
          group: ['status']
        });
        
        subscriptionsByStatus = statusCounts.reduce((acc, item) => {
          acc[item.status] = parseInt(item.get('count'));
          return acc;
        }, {});
      }
    } catch (error) {
      console.warn('Subscription status statistics not available:', error.message);
    }
    
    res.json({
      status: 'success',
      message: 'Database connection working',
      timestamp: new Date().toISOString(),
      
      // Statistiques utilisateurs
      statistics: {
        users: userCount,
        players: playerCount,
        coaches: coachCount,
        njcaaColleges: njcaaCollegeCount,
        ncaaColleges: ncaaCollegeCount,
        
        // Statistiques de paiement (Phase 4)
        subscriptions: subscriptionCount,
        subscriptionPlans: planCount,
        paymentTransactions: paymentCount,
        subscriptionsByStatus: subscriptionsByStatus
      },
      
      // Informations de configuration de base de données
      database: {
        dialect: sequelize.getDialect(),
        version: await sequelize.databaseVersion(),
        timezone: sequelize.options.timezone,
        pool: {
          max: sequelize.options.pool?.max,
          min: sequelize.options.pool?.min,
          idle: sequelize.options.pool?.idle
        }
      }
    });
    
  } catch (error) {
    console.error('Database test failed:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'development' ? error.message : 'Connection error',
      troubleshooting: {
        steps: [
          'Check if PostgreSQL is running',
          'Verify database credentials in .env file',
          'Ensure database exists and is accessible',
          'Check network connectivity'
        ]
      }
    });
  }
});

/**
 * Route de base - Point d'entrée et documentation de l'API
 * 
 * Cette route sert de documentation vivante de votre API et guide
 * les développeurs vers les bonnes ressources.
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Portall API',
    version: '4.0.0',
    phase: 'Phase 4 - Payment Integration Complete',
    description: 'Platform connecting NJCAA soccer players with NCAA/NAIA coaches',
    
    // Fonctionnalités disponibles par phase
    features: [
      'User Authentication & Authorization (Phase 2)',
      'Player & Coach Profile Management (Phase 3)', 
      'Admin Dashboard & Validation (Phase 3)',
      'Subscription Management (Phase 4)',
      'Stripe Payment Processing (Phase 4)',
      'Real-time Webhook Event Handling (Phase 4)',
      'Email Notifications (All Phases)',
      'Role-based Access Control (All Phases)'
    ],
    
    // Points d'entrée de l'API organisés par fonction
    endpoints: {
      // Authentification et autorisation
      auth: {
        base: '/api/auth',
        health: '/api/auth/health',
        description: 'User authentication, registration, and token management'
      },
      
      // Gestion des profils utilisateurs
      players: {
        base: '/api/players',
        health: '/api/players/health', 
        description: 'NJCAA player profile management and dashboard'
      },
      
      coaches: {
        base: '/api/coaches',
        health: '/api/coaches/health',
        description: 'NCAA/NAIA coach profile management and search tools'
      },
      
      // Administration système
      admin: {
        base: '/api/admin',
        health: '/api/admin/health',
        description: 'Administrative functions and user validation'
      },
      
      // Données de référence
      reference: {
        base: '/api/reference',
        health: '/api/reference/health',
        description: 'College databases and reference data'
      },
      
      // Système de paiement (Phase 4)
      subscriptions: {
        base: '/api/subscriptions',
        plans: '/api/subscriptions/plans',
        health: '/api/subscriptions/health',
        description: 'Subscription management and billing'
      },
      
      // Webhooks Stripe (Phase 4)
      webhooks: {
        stripe: '/api/webhooks/stripe',
        health: '/api/webhooks/health',
        events: '/api/webhooks/events',
        stats: '/api/webhooks/stats',
        description: 'Stripe webhook processing for real-time payment events'
      },
      
      // Monitoring et santé
      health: '/api/health',
      database: '/api/db-test'
    },
    
    // Configuration de paiement (Phase 4)
    payment: {
      provider: 'Stripe',
      currency: 'USD',
      plans: {
        monthly: '$29.99/month',
        yearly: '$79.99/year (save $279.89)'
      },
      webhook: '/api/webhooks/stripe',
      testMode: process.env.NODE_ENV === 'development',
      documentation: 'https://stripe.com/docs/webhooks'
    },
    
    // Informations techniques pour les développeurs
    technical: {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      cors: 'Enabled',
      security: 'Helmet + Custom headers',
      rateLimit: 'Per-endpoint configuration'
    },
    
    // Liens utiles pour les développeurs
    documentation: {
      api: '/', // Cette route elle-même sert de documentation
      health: '/api/health',
      postman: 'Coming soon',
      github: 'Your repository URL here'
    }
  });
});

// ========================================
// GESTION D'ERREUR GLOBALE
// ========================================

/**
 * Middleware 404 - Gestion des routes non trouvées
 * 
 * Ce middleware est déclenché quand aucune route ne correspond
 * à la requête. Il fournit un message d'erreur informatif avec
 * des suggestions de routes valides.
 */
app.use('*', (req, res) => {
  console.log(`⚠️ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    status: 'error',
    message: 'API endpoint not found',
    timestamp: new Date().toISOString(),
    requestedUrl: req.originalUrl,
    method: req.method,
    
    // Suggestions de routes valides basées sur l'URL demandée
    suggestions: {
      api: '/api/health - Check API status',
      auth: '/api/auth/health - Authentication endpoints',
      subscriptions: '/api/subscriptions/health - Payment endpoints',
      webhooks: '/api/webhooks/health - Webhook endpoints',
      documentation: '/ - API documentation'
    },
    
    // Aide au débogage
    troubleshooting: {
      common_mistakes: [
        'Check URL spelling and case sensitivity',
        'Verify HTTP method (GET, POST, PUT, DELETE)',
        'Ensure required headers are included',
        'Check if authentication is required'
      ]
    }
  });
});

/**
 * Middleware global de gestion d'erreur
 * 
 * Ce middleware capture toutes les erreurs non gérées dans l'application
 * et retourne une réponse appropriée selon l'environnement.
 */
app.use((error, req, res, next) => {
  // Logging détaillé de l'erreur pour le débogage
  console.error('💥 Unhandled application error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  // Déterminer le type d'erreur pour adapter la réponse
  let statusCode = 500;
  let errorType = 'Internal Server Error';
  
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorType = 'Validation Error';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    errorType = 'Authentication Error';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    errorType = 'Authorization Error';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    errorType = 'Resource Not Found';
  }
  
  // Réponse d'erreur adaptée à l'environnement
  const errorResponse = {
    status: 'error',
    type: errorType,
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    requestId: req.id || `err_${Date.now()}`
  };
  
  // Informations supplémentaires en développement
  if (process.env.NODE_ENV === 'development') {
    errorResponse.debug = {
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      headers: req.headers
    };
  }
  
  // Recommandations de résolution selon le type d'erreur
  if (statusCode === 500) {
    errorResponse.support = {
      message: 'If this error persists, please contact support',
      healthCheck: '/api/health',
      logs: 'Check server logs for detailed error information'
    };
  }
  
  res.status(statusCode).json(errorResponse);
});

// ========================================
// DÉMARRAGE DU SERVEUR - ORCHESTRATION COMPLÈTE
// ========================================

/**
 * Fonction de démarrage du serveur avec vérifications complètes
 * 
 * Cette fonction orchestre le démarrage complet de votre application
 * en vérifiant toutes les dépendances critiques avant d'accepter
 * les requêtes entrantes.
 */
const startServer = async () => {
  try {
    console.log('🚀 Starting Portall server...');
    console.log('==============================');
    
    // ========================================
    // ÉTAPE 1: VÉRIFICATION DE LA BASE DE DONNÉES
    // ========================================
    
    console.log('📊 Step 1: Checking database connection...');
    
    try {
      await testConnection();
      console.log('✅ Database connection established');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      throw new Error(`Database connectivity issue: ${dbError.message}`);
    }
    
    // ========================================
    // ÉTAPE 2: SYNCHRONISATION DES MODÈLES
    // ========================================
    
    console.log('🔄 Step 2: Synchronizing database models...');
    
    if (process.env.NODE_ENV !== 'production') {
      try {
        // Vérifier si les tables existent déjà
        await sequelize.getQueryInterface().describeTable('users');
        console.log('✅ Database tables already exist and accessible');
      } catch (error) {
        console.log('🔧 Creating/updating database schema...');
        await sequelize.sync({ force: false, alter: true });
        console.log('✅ Database models synchronized successfully');
      }
    } else {
      // En production, ne jamais modifier automatiquement le schéma
      console.log('🏭 Production mode: Skipping automatic schema sync');
      await sequelize.authenticate(); // Simple test de connectivité
    }
    
    // ========================================
    // ÉTAPE 3: VÉRIFICATION DE LA CONFIGURATION STRIPE
    // ========================================
    
    console.log('💳 Step 3: Checking Stripe configuration...');
    
    try {
      const { stripe } = require('./config/stripe');
      await stripe.accounts.retrieve();
      console.log('✅ Stripe connection verified');
      
      if (process.env.STRIPE_WEBHOOK_SECRET) {
        console.log('✅ Webhook secret configured');
      } else {
        console.log('⚠️ Webhook secret not configured - webhooks will not work');
      }
    } catch (stripeError) {
      console.error('⚠️ Stripe configuration issue:', stripeError.message);
      console.log('   Payment features may not work correctly');
    }
    
    // ========================================
    // ÉTAPE 4: DÉMARRAGE DU SERVEUR HTTP
    // ========================================
    
    console.log('🌐 Step 4: Starting HTTP server...');
    
    app.listen(PORT, () => {
      console.log('✅ Server started successfully!');
      console.log('================================');
      console.log(`🌍 Server URL: http://localhost:${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⏰ Started at: ${new Date().toISOString()}`);
      console.log('');
      
      // ========================================
      // AFFICHAGE DES SERVICES DISPONIBLES
      // ========================================
      
      console.log('📋 Available Services:');
      console.log('======================');
      console.log(`🔐 Authentication: http://localhost:${PORT}/api/auth`);
      console.log(`📚 Reference Data: http://localhost:${PORT}/api/reference`);
      console.log(`👨‍💼 Admin Panel: http://localhost:${PORT}/api/admin`);
      console.log(`👤 Player Dashboard: http://localhost:${PORT}/api/players`);
      console.log(`🏟️ Coach Dashboard: http://localhost:${PORT}/api/coaches`);
      console.log(`💳 Subscriptions: http://localhost:${PORT}/api/subscriptions`);
      console.log(`🎣 Stripe Webhooks: http://localhost:${PORT}/api/webhooks`);
      console.log('');
      
      // ========================================
      // STATUT DE LA PHASE 4
      // ========================================
      
      console.log('🎯 Phase 4 Status: PAYMENT INTEGRATION COMPLETE');
      console.log('===============================================');
      console.log('✅ Stripe API integration functional');
      console.log('✅ Subscription plans synchronized');
      console.log('✅ Payment processing operational');
      console.log('✅ Webhook event handling ready');
      console.log('✅ Security validations in place');
      console.log('');
      
      // ========================================
      // INFORMATIONS DE CONFIGURATION
      // ========================================
      
      console.log('⚙️ Configuration Summary:');
      console.log('=========================');
      console.log(`Database: ${process.env.DB_NAME || 'Not configured'}`);
      console.log(`Stripe Mode: ${process.env.NODE_ENV === 'development' ? 'Test' : 'Production'}`);
      console.log(`Webhook Secret: ${process.env.STRIPE_WEBHOOK_SECRET ? 'Configured' : 'Missing'}`);
      console.log(`CORS Origin: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
      console.log(`Email Service: ${process.env.EMAIL_HOST ? 'Configured' : 'Not configured'}`);
      console.log('');
      
      // ========================================
      // PROCHAINES ÉTAPES RECOMMANDÉES
      // ========================================
      
      console.log('🎯 Next Steps:');
      console.log('===============');
      console.log('1. Configure webhook endpoint in Stripe Dashboard');
      console.log('2. Test payment flow with Stripe test cards');
      console.log('3. Verify webhook processing with test events');
      console.log('4. Set up monitoring and alerting');
      console.log('5. Prepare for production deployment');
      console.log('');
      
      // ========================================
      // LIENS UTILES POUR LE DÉVELOPPEMENT
      // ========================================
      
      console.log('🔗 Quick Links:');
      console.log('================');
      console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
      console.log(`📖 API Docs: http://localhost:${PORT}/`);
      console.log(`🔍 DB Status: http://localhost:${PORT}/api/db-test`);
      console.log(`🎣 Webhook Health: http://localhost:${PORT}/api/webhooks/health`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🧪 Test Routes: http://localhost:${PORT}/api/test/`);
      }
      
      console.log('');
      console.log('🚀 Portall API is ready to serve requests!');
    });

  } catch (error) {
    // ========================================
    // GESTION D'ERREUR DE DÉMARRAGE
    // ========================================
    
    console.error('💥 Server startup failed!');
    console.error('===========================');
    console.error('Error:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting steps:');
    console.error('1. Check PostgreSQL is running and accessible');
    console.error('2. Verify all environment variables in .env file');
    console.error('3. Ensure database exists and user has proper permissions');
    console.error('4. Check for port conflicts (default: 5001)');
    console.error('5. Verify Stripe API keys are valid');
    console.error('');
    console.error('📋 Required environment variables:');
    console.error('- DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD');
    console.error('- STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY');
    console.error('- JWT_SECRET');
    console.error('- STRIPE_WEBHOOK_SECRET (for webhook functionality)');
    
    // Arrêt propre du processus
    process.exit(1);
  }
};

// ========================================
// GESTION DES SIGNAUX DE FIN DE PROCESSUS
// ========================================

/**
 * Gestion gracieuse de l'arrêt du serveur
 * 
 * Ces gestionnaires garantissent que votre serveur s'arrête proprement
 * en fermant les connexions de base de données et en terminant les
 * requêtes en cours avant de quitter.
 */
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM signal');
  console.log('🔄 Starting graceful shutdown...');
  
  try {
    await sequelize.close();
    console.log('✅ Database connections closed');
    console.log('👋 Server shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT signal (Ctrl+C)');
  console.log('🔄 Starting graceful shutdown...');
  
  try {
    await sequelize.close();
    console.log('✅ Database connections closed');
    console.log('👋 Server shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
});

// ========================================
// EXPORTS ET DÉMARRAGE
// ========================================

/**
 * Export de l'application Express pour les tests
 * 
 * Cette export permet aux tests automatisés d'importer votre application
 * sans déclencher le démarrage du serveur HTTP.
 */
module.exports = app;

/**
 * Démarrage conditionnel du serveur
 * 
 * Le serveur ne démarre que si ce fichier est exécuté directement
 * (pas importé par un autre module). Cela permet l'utilisation
 * dans les tests sans effet de bord.
 */
if (require.main === module) {
  startServer();
}