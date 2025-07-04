// portall/server/routes/subscriptions.js

/**
 * Routes des abonnements Portall
 * 
 * Ce fichier définit tous les endpoints liés à la gestion des abonnements.
 * Chaque route suit le pattern REST et inclut les middleware appropriés
 * pour la sécurité, la validation, et la gestion d'erreur.
 * 
 * Architecture des routes :
 * Route -> Middleware(s) -> Controller -> Service -> Model -> Database/Stripe
 * 
 * Sécurité multicouche :
 * 1. Rate limiting (protection contre le spam)
 * 2. Authentification JWT (utilisateur connecté)
 * 3. Validation des données (format et contenu)
 * 4. Autorisation métier (droits spécifiques)
 */

const express = require('express');
const router = express.Router();

// Import des middleware de sécurité et validation
const { authenticateToken } = require('../middleware/auth');
const { validateSubscriptionData } = require('../middleware/subscriptionValidation');
const rateLimit = require('express-rate-limit');

// Import du contrôleur
const subscriptionController = require('../controllers/subscriptionController');

/**
 * Configuration du rate limiting spécifique aux paiements
 * 
 * Les opérations de paiement sont sensibles et peuvent être coûteuses.
 * Nous appliquons des limites strictes pour éviter les abus et les erreurs.
 */

// Rate limiting pour les consultations (plus permissif)
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

// Rate limiting pour les créations/modifications (plus restrictif)
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
  // Options spécifiques pour les paiements
  skipSuccessfulRequests: true, // Ne compter que les échecs
  keyGenerator: (req) => {
    // Combiner IP et utilisateur pour un rate limiting plus précis
    return req.user ? `${req.ip}_${req.user.id}` : req.ip;
  }
});

/**
 * GET /api/subscriptions/plans
 * 
 * Récupère tous les plans d'abonnement disponibles
 * 
 * Route publique - Pas d'authentification requise
 * Utilisée pour afficher les tarifs sur la page de pricing
 */
router.get('/plans', 
  readRateLimit,
  subscriptionController.getAvailablePlans
);

/**
 * POST /api/subscriptions/create
 * 
 * Crée un nouvel abonnement pour l'utilisateur authentifié
 * 
 * Route protégée - Authentification requise
 * Validation stricte des données de paiement
 * Rate limiting restrictif pour éviter les abus
 */
router.post('/create',
  writeRateLimit,
  authenticateToken, // L'utilisateur doit être connecté
  validateSubscriptionData.createSubscription, // Validation des données
  subscriptionController.createSubscription
);

/**
 * GET /api/subscriptions/my-subscription
 * 
 * Récupère l'abonnement actuel de l'utilisateur authentifié
 * 
 * Route protégée - L'utilisateur ne peut voir que son propre abonnement
 */
router.get('/my-subscription',
  readRateLimit,
  authenticateToken,
  subscriptionController.getMySubscription
);

/**
 * POST /api/subscriptions/cancel
 * 
 * Annule l'abonnement de l'utilisateur authentifié
 * 
 * Route protégée avec validation de la raison d'annulation
 */
router.post('/cancel',
  writeRateLimit,
  authenticateToken,
  validateSubscriptionData.cancelSubscription, // Validation optionnelle
  subscriptionController.cancelSubscription
);

/**
 * GET /api/subscriptions/health
 * 
 * Endpoint de santé pour vérifier que le service d'abonnement fonctionne
 * 
 * Utile pour le monitoring et les tests automatisés
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Subscription service is healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      'GET /plans': 'public',
      'POST /create': 'authenticated',
      'GET /my-subscription': 'authenticated', 
      'POST /cancel': 'authenticated'
    }
  });
});

module.exports = router;