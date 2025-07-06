// portall/server/routes/njcaaCoaches.js

const express = require('express');
const NJCAACoachController = require('../controllers/njcaaCoachController');
const { authenticate, authorize } = require('../middleware/auth');
const { validatePlayerEvaluation } = require('../middleware/advancedValidation');
const { playerEvaluationLimiter, generalRateLimit } = require('../middleware/rateLimiting');
const Joi = require('joi');

const router = express.Router();

/**
 * Routes spécialisées pour les coachs NJCAA
 * 
 * ARCHITECTURE : Ces routes implémentent le workflow spécifique aux coachs NJCAA
 * qui est centré sur l'évaluation de leurs joueurs plutôt que sur la recherche
 * et les abonnements comme les coachs NCAA/NAIA.
 * 
 * Toutes les routes nécessitent :
 * 1. Authentification (utilisateur connecté)
 * 2. Autorisation (type d'utilisateur 'njcaa_coach')
 * 3. Rate limiting approprié selon l'action
 */

// ========================
// MIDDLEWARE D'AUTORISATION SPÉCIALISÉ
// ========================

/**
 * Middleware pour vérifier que l'utilisateur est bien un coach NJCAA
 * 
 * Ce middleware s'assure que seuls les utilisateurs de type 'njcaa_coach'
 * peuvent accéder à ces routes, implémentant une sécurité par rôle.
 */
const requireNJCAACoachAccess = (req, res, next) => {
  if (req.user.userType !== 'njcaa_coach') {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. This endpoint is only available to NJCAA coaches.',
      code: 'NJCAA_COACH_ACCESS_REQUIRED'
    });
  }
  next();
};

// ========================
// ROUTES DU DASHBOARD PRINCIPAL
// ========================

/**
 * GET /api/njcaa-coaches/dashboard
 * 
 * Page principale du coach NJCAA avec la liste de ses joueurs
 * et les fonctionnalités d'évaluation.
 * 
 * Cette route implémente la "Main Page" de tes spécifications.
 */
router.get('/dashboard',
  authenticate,
  requireNJCAACoachAccess,
  generalRateLimit,
  NJCAACoachController.getDashboard
);

/**
 * GET /api/njcaa-coaches/settings
 * 
 * Page "Settings" pour la gestion du profil personnel du coach.
 * 
 * Cette route implémente la deuxième page du dashboard selon tes spécifications.
 */
router.get('/settings',
  authenticate,
  requireNJCAACoachAccess,
  generalRateLimit,
  NJCAACoachController.getSettings
);

/**
 * PUT /api/njcaa-coaches/settings
 * 
 * Mise à jour des paramètres modifiables du profil coach.
 * 
 * Seuls certains champs peuvent être modifiés sans validation admin.
 */
router.put('/settings',
  authenticate,
  requireNJCAACoachAccess,
  generalRateLimit,
  // Validation des données de mise à jour
  (req, res, next) => {
    const updateSchema = Joi.object({
      phoneNumber: Joi.string()
        .pattern(/^\+?[\d\s\-\(\)]+$/)
        .min(10)
        .max(20)
        .optional()
        .messages({
          'string.pattern.base': 'Please provide a valid phone number',
          'string.min': 'Phone number must be at least 10 characters',
          'string.max': 'Phone number must not exceed 20 characters'
        })
    }).options({
      abortEarly: false,
      stripUnknown: true
    });

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error in settings update',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.body = value;
    next();
  },
  NJCAACoachController.updateSettings
);

// ========================
// ROUTES D'ÉVALUATION DES JOUEURS
// ========================

/**
 * GET /api/njcaa-coaches/players/:playerId/evaluation
 * 
 * Récupérer l'évaluation actuelle d'un joueur spécifique.
 * 
 * Utilisé pour pré-remplir le formulaire d'évaluation côté client.
 */
router.get('/players/:playerId/evaluation',
  authenticate,
  requireNJCAACoachAccess,
  generalRateLimit,
  // Validation du paramètre playerId
  (req, res, next) => {
    const paramSchema = Joi.object({
      playerId: Joi.number().integer().positive().required()
    });

    const { error, value } = paramSchema.validate(req.params);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid player ID',
        code: 'INVALID_PLAYER_ID'
      });
    }

    req.params = value;
    next();
  },
  NJCAACoachController.getPlayerEvaluation
);

/**
 * POST /api/njcaa-coaches/players/:playerId/evaluation
 * 
 * Créer ou mettre à jour l'évaluation d'un joueur.
 * 
 * Cette route implémente le cœur de la fonctionnalité métier des coachs NJCAA
 * avec toutes les questions d'évaluation que tu as spécifiées.
 */
router.post('/players/:playerId/evaluation',
  authenticate,
  requireNJCAACoachAccess,
  playerEvaluationLimiter, // Rate limiting plus restrictif pour les évaluations
  // Validation du paramètre playerId
  (req, res, next) => {
    const paramSchema = Joi.object({
      playerId: Joi.number().integer().positive().required()
    });

    const { error, value } = paramSchema.validate(req.params);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid player ID',
        code: 'INVALID_PLAYER_ID'
      });
    }

    req.params = value;
    next();
  },
  validatePlayerEvaluation, // Middleware de validation avancé pour les évaluations
  NJCAACoachController.evaluatePlayer
);

// ========================
// ROUTES OPTIONNELLES POUR FONCTIONNALITÉS AVANCÉES
// ========================

/**
 * GET /api/njcaa-coaches/evaluation-history
 * 
 * Historique complet des évaluations effectuées par le coach.
 * 
 * Route optionnelle pour les coachs qui veulent suivre leur activité.
 */
router.get('/evaluation-history',
  authenticate,
  requireNJCAACoachAccess,
  generalRateLimit,
  NJCAACoachController.getEvaluationHistory
);

// ========================
// ROUTE DE SANTÉ ET DIAGNOSTIC
// ========================

/**
 * GET /api/njcaa-coaches/health
 * 
 * Endpoint de santé pour vérifier que le service coach NJCAA fonctionne.
 * 
 * Utile pour le monitoring et les tests automatisés.
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'NJCAA Coach service is healthy',
    timestamp: new Date().toISOString(),
    service: 'njcaa-coaches',
    features: {
      dashboard: 'Player list and evaluation interface',
      settings: 'Profile management',
      evaluation: 'Player assessment system',
      history: 'Evaluation tracking'
    },
    endpoints: {
      'GET /dashboard': 'Main coach dashboard',
      'GET /settings': 'Profile settings',
      'PUT /settings': 'Update profile settings',
      'GET /players/:id/evaluation': 'Get player evaluation',
      'POST /players/:id/evaluation': 'Create/update player evaluation',
      'GET /evaluation-history': 'Evaluation history'
    },
    userType: 'njcaa_coach',
    accessLevel: 'authenticated_njcaa_coach_only'
  });
});

module.exports = router;