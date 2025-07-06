// portall/server/routes/njcaaCoaches.js

const express = require('express');
const NJCAACoachController = require('../controllers/njcaaCoachController');
const { authenticate, authorize } = require('../middleware/auth');
const { validatePlayerEvaluation } = require('../middleware/advancedValidation');
const { generalAuthLimiter } = require('../middleware/rateLimiting');
const Joi = require('joi');

const router = express.Router();

/**
 * Routes spécialisées pour les coachs NJCAA
 * 
 * ARCHITECTURE PÉDAGOGIQUE : Ces routes illustrent parfaitement comment structurer
 * une API REST selon les domaines métier. Chaque endpoint correspond à une fonctionnalité
 * spécifique du workflow des coachs NJCAA que tu as défini dans tes spécifications.
 * 
 * CONCEPTS ENSEIGNÉS :
 * 1. SÉPARATION DES RESPONSABILITÉS : Routes = Interface HTTP, Controller = Logique métier
 * 2. MIDDLEWARE EN CASCADE : Chaque requête passe par plusieurs couches de validation
 * 3. CONVENTIONS REST : GET pour lire, POST pour créer, PUT pour modifier
 * 4. SÉCURITÉ MULTICOUCHE : Authentification + Autorisation + Validation + Rate limiting
 * 
 * Cette approche modulaire facilite la maintenance et l'évolution future de l'API.
 */

// ========================
// MIDDLEWARE D'AUTORISATION SPÉCIALISÉ
// ========================

/**
 * Middleware pour vérifier que l'utilisateur est bien un coach NJCAA
 * 
 * EXPLICATION PÉDAGOGIQUE : Ce middleware illustre le principe de responsabilité unique.
 * Au lieu de vérifier le type d'utilisateur dans chaque contrôleur, nous le faisons
 * une seule fois ici, gardant les contrôleurs focalisés sur la logique métier.
 * 
 * C'est un excellent exemple de "fail fast" - nous rejetons les requêtes non autorisées
 * le plus tôt possible dans le pipeline, économisant les ressources serveur.
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
 * 
 * EXPLICATION : Cette route implémente ta "Main Page" avec toutes ses fonctionnalités :
 * - Liste dynamique des joueurs du même college et genre
 * - Statuts d'évaluation pour chaque joueur
 * - Statistiques d'activité du coach
 * - Interface pour démarrer les évaluations
 */
router.get('/dashboard',
  authenticate, // COUCHE 1 : Utilisateur connecté ?
  requireNJCAACoachAccess, // COUCHE 2 : Type d'utilisateur correct ?
  generalAuthLimiter, // COUCHE 3 : Limite de fréquence respectée ?
  NJCAACoachController.getDashboard // COUCHE 4 : Logique métier
);

/**
 * GET /api/njcaa-coaches/settings
 * 
 * Page "Settings" pour la gestion du profil personnel
 * 
 * CONCEPT : Cette route montre comment séparer les préoccupations entre
 * dashboard (données métier) et settings (configuration personnelle).
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
 * Mise à jour des paramètres modifiables du profil
 * 
 * SÉCURITÉ : Cette route inclut une validation Joi inline pour démontrer
 * comment sécuriser les modifications de données sensibles.
 */
router.put('/settings',
  authenticate,
  requireNJCAACoachAccess,
  generalAuthLimiter,
  // VALIDATION INLINE : Exemple de validation spécialisée pour un endpoint unique
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
  validatePlayerEvaluation, // VALIDATION MÉTIER : Toutes les questions d'évaluation
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