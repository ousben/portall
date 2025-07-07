// server/routes/njcaaCoaches.js

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const NJCAACoachController = require('../controllers/njcaaCoachController');
const { authenticate, requireNJCAACoach } = require('../middleware/auth');
const { generalAuthLimiter } = require('../middleware/rateLimiting');
const { validatePlayerEvaluation } = require('../middleware/playerEvaluationValidation');

/**
 * 🏟️ Routes dédiées aux coachs NJCAA - COMPLÈTES ET FONCTIONNELLES
 * 
 * Ces routes implémentent l'interface spécialisée pour les coachs NJCAA,
 * leur permettant d'évaluer les joueurs de leur college selon des critères
 * précis définis dans le système de recrutement sportif.
 * 
 * 🔐 SÉCURITÉ : Toutes les routes requièrent une authentification valide
 * ET une autorisation spécifique NJCAA coach pour garantir que seuls
 * les coachs autorisés peuvent accéder aux fonctionnalités d'évaluation.
 */

// ========================
// ROUTES PRINCIPALES DU DASHBOARD
// ========================

/**
 * GET /api/njcaa-coaches/dashboard
 * 
 * Dashboard principal pour les coachs NJCAA
 */
router.get('/dashboard',
  authenticate,
  requireNJCAACoach,
  generalAuthLimiter,
  NJCAACoachController.getDashboard
);

// ========================
// ROUTES DE GESTION DU PROFIL
// ========================

/**
 * GET /api/njcaa-coaches/settings
 * 
 * Récupérer les paramètres actuels du profil coach
 */
router.get('/settings',
  authenticate,
  requireNJCAACoach,
  generalAuthLimiter,
  NJCAACoachController.getSettings
);

/**
 * PUT /api/njcaa-coaches/settings
 * 
 * ✅ ROUTE MANQUANTE AJOUTÉE - Mettre à jour les paramètres du profil coach
 */
router.put('/settings',
  authenticate,
  requireNJCAACoach,
  generalAuthLimiter,
  // Validation des données de mise à jour
  (req, res, next) => {
    const settingsSchema = Joi.object({
      position: Joi.string().valid('head_coach', 'assistant_coach', 'goalkeeper_coach', 'fitness_coach').optional(),
      phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
    }).min(1); // Au moins un champ requis

    const { error, value } = settingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Settings validation failed',
        code: 'SETTINGS_VALIDATION_ERROR',
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
 * Récupérer l'évaluation existante d'un joueur
 */
router.get('/players/:playerId/evaluation',
  authenticate,
  requireNJCAACoach,
  generalAuthLimiter,
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
 * Créer ou mettre à jour l'évaluation d'un joueur
 */
router.post('/players/:playerId/evaluation',
  authenticate,
  requireNJCAACoach,
  generalAuthLimiter,
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
  validatePlayerEvaluation,
  NJCAACoachController.evaluatePlayer
);

// ========================
// ROUTES OPTIONNELLES POUR FONCTIONNALITÉS AVANCÉES
// ========================

/**
 * GET /api/njcaa-coaches/evaluation-history
 * 
 * Historique complet des évaluations effectuées par le coach
 */
router.get('/evaluation-history',
  authenticate,
  requireNJCAACoach,
  generalAuthLimiter,
  NJCAACoachController.getEvaluationHistory
);

// ========================
// ROUTE DE SANTÉ ET DIAGNOSTIC
// ========================

/**
 * GET /api/njcaa-coaches/health
 * 
 * Endpoint de santé pour vérifier que le service coach NJCAA fonctionne
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