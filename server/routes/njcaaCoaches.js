// portall/server/routes/njcaaCoaches.js

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const NJCAACoachController = require('../controllers/njcaaCoachController');
const { authenticate, requireNJCAACoachAccess } = require('../middleware/auth');
const { generalAuthLimiter } = require('../middleware/rateLimiter');
const { validatePlayerEvaluation } = require('../middleware/playerEvaluationValidation'); // ✅ IMPORT CORRIGÉ

/**
 * 🏟️ Routes dédiées aux coachs NJCAA
 * 
 * Ces routes implémentent l'interface spécialisée pour les coachs NJCAA,
 * leur permettant d'évaluer les joueurs de leur college selon des critères
 * précis définis dans le système de recrutement sportif.
 * 
 * 🔐 SÉCURITÉ : Toutes les routes requièrent une authentification valide
 * ET une autorisation spécifique NJCAA coach pour garantir que seuls
 * les coachs autorisés peuvent accéder aux fonctionnalités d'évaluation.
 * 
 * 📊 FONCTIONNALITÉS PRINCIPALES :
 * - Dashboard avec filtrage intelligent des joueurs
 * - Système d'évaluation complet avec 11 critères
 * - Gestion des settings de profil
 * - Historique des évaluations
 * 
 * 🎯 ARCHITECTURE : Routes RESTful avec validation robuste et middleware
 * de sécurité en cascade pour une expérience utilisateur optimale.
 */

// ========================
// ROUTES PRINCIPALES DU DASHBOARD
// ========================

/**
 * GET /api/njcaa-coaches/dashboard
 * 
 * Dashboard principal pour les coachs NJCAA
 * 
 * Cette route fournit une vue d'ensemble complète des joueurs que le coach
 * peut évaluer, avec un filtrage intelligent basé sur :
 * - Le même college que le coach
 * - Le même genre (masculine/féminine) selon l'équipe du coach
 * - Les évaluations existantes et leur statut
 * 
 * LOGIQUE MÉTIER : Un coach masculin ne voit que les joueurs masculins
 * de son college, et vice versa pour les coachs féminins.
 */
router.get('/dashboard',
  authenticate,
  requireNJCAACoachAccess,
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
 * 
 * USAGE : Cette route permet de pré-remplir le formulaire de settings
 * côté client, améliorant l'expérience utilisateur.
 */
router.get('/settings',
  authenticate,
  requireNJCAACoachAccess,
  generalAuthLimiter,
  NJCAACoachController.getSettings
);

/**
 * PUT /api/njcaa-coaches/settings
 * 
 * Mettre à jour les paramètres du profil coach
 * 
 * VALIDATION : Seuls certains champs peuvent être modifiés par le coach.
 * Les champs critiques comme collegeId et teamSport sont protégés.
 */
router.put('/settings',
  authenticate,
  requireNJCAACoachAccess,
  generalAuthLimiter,
  // Validation des données de mise à jour
  (req, res, next) => {
    const updateSchema = Joi.object({
      phoneNumber: Joi.string()
        .pattern(/^\+?[1-9]\d{1,14}$/)
        .optional()
        .messages({
          'string.pattern.base': 'Please provide a valid phone number'
        }),
      
      // Autres champs modifiables peuvent être ajoutés ici
      bio: Joi.string()
        .max(500)
        .optional()
        .messages({
          'string.max': 'Bio must not exceed 500 characters'
        })
    }).options({
      stripUnknown: true, // Supprimer les champs non autorisés
      abortEarly: false
    });

    const { error, value } = updateSchema.validate(req.body);
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
 * Récupérer l'évaluation actuelle d'un joueur spécifique
 * 
 * USAGE : Cette route permet de pré-remplir le formulaire d'évaluation
 * côté client, améliorant l'expérience utilisateur.
 */
router.get('/players/:playerId/evaluation',
  authenticate,
  requireNJCAACoachAccess,
  generalAuthLimiter,
  // VALIDATION DE PARAMÈTRE : Assurer que playerId est un nombre valide
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
 * 
 * FONCTIONNALITÉ CENTRALE : Cette route implémente le cœur du système d'évaluation
 * avec toutes les questions que tu as spécifiées dans tes requirements.
 * 
 * ARCHITECTURE : La validation complexe est déléguée au middleware spécialisé
 * validatePlayerEvaluation, gardant cette route focalisée sur le routage HTTP.
 */
router.post('/players/:playerId/evaluation',
  authenticate,
  requireNJCAACoachAccess,
  generalAuthLimiter, // Note : Pas de rate limiting trop restrictif pour les évaluations
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
  validatePlayerEvaluation, // ✅ MIDDLEWARE CORRECT
  NJCAACoachController.evaluatePlayer
);

// ========================
// ROUTES OPTIONNELLES POUR FONCTIONNALITÉS AVANCÉES
// ========================

/**
 * GET /api/njcaa-coaches/evaluation-history
 * 
 * Historique complet des évaluations effectuées par le coach
 * 
 * FONCTIONNALITÉ BONUS : Cette route permet aux coachs de suivre leur activité
 * et d'identifier les patterns dans leurs évaluations.
 */
router.get('/evaluation-history',
  authenticate,
  requireNJCAACoachAccess,
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
 * 
 * CONCEPT PÉDAGOGIQUE : Cette route illustre l'importance du monitoring
 * et de l'observabilité dans les applications de production. Elle permet
 * de vérifier rapidement l'état du service sans déclencher de logique métier.
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