// portall/server/routes/coaches.js

const express = require('express');
const CoachController = require('../controllers/coachController');
const { authenticate, authorize, checkOwnership } = require('../middleware/auth');
const { generalAuthLimiter } = require('../middleware/rateLimiting');
const { validateProfileUpdate, validatePlayerSearch } = require('../middleware/advancedValidation');

const router = express.Router();

/**
 * Routes pour les coachs NCAA/NAIA avec leurs dashboards et fonctionnalités de recrutement
 * 
 * Ces routes sont plus complexes que celles des joueurs car les coachs ont des besoins
 * métier plus sophistiqués : recherche, favoris, analytics de recrutement, etc.
 * 
 * Analogie : Si les routes players sont comme un "casier personnel", les routes coaches
 * sont comme un "bureau de recruteur" avec des outils spécialisés pour trouver et évaluer les talents.
 */

// ========================
// ROUTES DE CONSULTATION (DASHBOARD COACH)
// ========================

// GET /api/coaches/dashboard
// Dashboard principal du coach avec métriques de recrutement
router.get('/dashboard',
  authenticate,
  authorize('coach'),
  generalAuthLimiter,
  CoachController.getDashboard
);

// GET /api/coaches/:coachId/profile
// Profil public d'un coach spécifique
router.get('/:coachId/profile',
  authenticate,
  authorize(['player', 'coach', 'admin']),
  generalAuthLimiter,
  CoachController.getCoachProfile
);

// GET /api/coaches/analytics
// Analytics détaillées du coach (recherches, vues, etc.)
router.get('/analytics',
  authenticate,
  authorize('coach'),
  generalAuthLimiter,
  CoachController.getCoachAnalytics
);

// ========================
// ROUTES DE MODIFICATION
// ========================

// PUT /api/coaches/profile
// Mise à jour du profil du coach connecté
router.put('/profile',
  authenticate,
  authorize('coach'),
  generalAuthLimiter,
  validateProfileUpdate('coach'), // Validation spécialisée pour coachs
  CoachController.updateCoachProfile
);

// ========================
// FONCTIONNALITÉS DE RECRUTEMENT
// ========================

// GET /api/coaches/favorites
// Liste des joueurs favoris du coach
router.get('/favorites',
  authenticate,
  authorize('coach'),
  generalAuthLimiter,
  CoachController.getFavoriteProfiles
);

// POST /api/coaches/favorites/:playerId
// Ajouter un joueur aux favoris
router.post('/favorites/:playerId',
  authenticate,
  authorize('coach'),
  generalAuthLimiter,
  CoachController.addToFavorites
);

// DELETE /api/coaches/favorites/:playerId
// Retirer un joueur des favoris
router.delete('/favorites/:playerId',
  authenticate,
  authorize('coach'),
  generalAuthLimiter,
  CoachController.removeFromFavorites
);

// PUT /api/coaches/favorites/:playerId
// Mettre à jour les notes/statut d'un favori
router.put('/favorites/:playerId',
  authenticate,
  authorize('coach'),
  generalAuthLimiter,
  CoachController.updateFavoriteStatus
);

// ========================
// GESTION DES RECHERCHES SAUVEGARDÉES
// ========================

// GET /api/coaches/saved-searches
// Récupérer les recherches sauvegardées
router.get('/saved-searches',
  authenticate,
  authorize('coach'),
  generalAuthLimiter,
  CoachController.getSavedSearches
);

// POST /api/coaches/saved-searches
// Sauvegarder une nouvelle recherche
router.post('/saved-searches',
  authenticate,
  authorize('coach'),
  generalAuthLimiter,
  validatePlayerSearch, // Validation des critères de recherche
  CoachController.saveSearch
);

// DELETE /api/coaches/saved-searches/:searchId
// Supprimer une recherche sauvegardée
router.delete('/saved-searches/:searchId',
  authenticate,
  authorize('coach'),
  generalAuthLimiter,
  CoachController.deleteSavedSearch
);

// ========================
// ROUTE DE SANTÉ
// ========================

router.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Coach routes are running',
    timestamp: new Date().toISOString(),
    availableEndpoints: {
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
    }
  });
});

module.exports = router;