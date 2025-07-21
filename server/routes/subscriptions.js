// portall/server/routes/subscriptions.js

const express = require('express');
const router = express.Router();

// Import des middleware de sécurité et validation
const { authenticate } = require('../middleware/auth');
const { validateSubscriptionData } = require('../middleware/subscriptionValidation');
const rateLimit = require('express-rate-limit');

// Import du contrôleur
const subscriptionController = require('../controllers/subscriptionController');

/**
 * 🚫 NOUVEAU MIDDLEWARE : Protection contre l'accès des coachs aux abonnements
 * 
 * Ce middleware implémente la nouvelle politique où seuls les joueurs
 * peuvent créer des abonnements. Les coachs ont maintenant un accès gratuit.
 * 
 * Analogie pédagogique : C'est comme un panneau "Accès réservé aux membres VIP"
 * devant certaines sections d'un club. Les coachs ont accès au club (plateforme)
 * mais plus besoin de payer pour les services premium.
 */
const restrictSubscriptionsToPlayers = (req, res, next) => {
  // Permettre la consultation des plans pour information (route GET /plans)
  if (req.method === 'GET' && req.path === '/plans') {
    return next();
  }
  
  // Pour toutes les autres actions (création, annulation), vérifier le type d'utilisateur
  if (req.user && req.user.userType !== 'player') {
    return res.status(403).json({
      status: 'error',
      message: 'Subscription management is currently available for players only. Coaches have free access to the platform.',
      code: 'SUBSCRIPTION_NOT_REQUIRED',
      userType: req.user.userType,
      accessPolicy: {
        coaches: 'Free access to all coaching features',
        players: 'Subscription required for premium features (future implementation)'
      },
      redirectTo: req.user.userType === 'coach' || req.user.userType === 'njcaa_coach' 
        ? '/dashboard/coach' 
        : '/dashboard'
    });
  }
  
  next();
};

/**
 * Configuration du rate limiting spécifique aux paiements
 */
const readRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par fenêtre par IP
  message: {
    status: 'error',
    message: 'Trop de requêtes de consultation, veuillez réessayer plus tard',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const writeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives de paiement par fenêtre par IP
  message: {
    status: 'error',
    message: 'Trop de tentatives de paiement, veuillez réessayer plus tard',
    code: 'PAYMENT_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return req.user ? `${req.ip}_${req.user.id}` : req.ip;
  }
});

/**
 * ROUTES DES ABONNEMENTS
 */

// GET /api/subscriptions/plans - Consultation libre des plans (pour information)
router.get('/plans', 
  readRateLimit,
  subscriptionController.getAvailablePlans
);

// POST /api/subscriptions/create - PROTÉGÉ : Seulement pour les joueurs
router.post('/create',
  writeRateLimit,
  authenticate,
  restrictSubscriptionsToPlayers, // NOUVEAU : Middleware de protection
  validateSubscriptionData.createSubscription,
  subscriptionController.createSubscription
);

// GET /api/subscriptions/my-subscription - PROTÉGÉ : Seulement pour les joueurs
router.get('/my-subscription',
  readRateLimit,
  authenticate,
  restrictSubscriptionsToPlayers, // NOUVEAU : Middleware de protection
  subscriptionController.getMySubscription
);

// POST /api/subscriptions/cancel - PROTÉGÉ : Seulement pour les joueurs  
router.post('/cancel',
  writeRateLimit,
  authenticate,
  restrictSubscriptionsToPlayers, // NOUVEAU : Middleware de protection
  validateSubscriptionData.cancelSubscription,
  subscriptionController.cancelSubscription
);

// GET /api/subscriptions/health - Route de santé (publique)
router.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Subscription service is healthy',
    timestamp: new Date().toISOString(),
    accessPolicy: {
      version: '2.0',
      coaches: 'Free access to platform - no subscription required',
      players: 'Subscription-based access (future implementation)'
    },
    endpoints: {
      'GET /plans': 'public - view available plans',
      'POST /create': 'players only - create subscription',
      'GET /my-subscription': 'players only - view current subscription', 
      'POST /cancel': 'players only - cancel subscription'
    }
  });
});

module.exports = router;