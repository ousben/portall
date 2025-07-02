// portall/server/routes/players.js

const express = require('express');
const PlayerController = require('../controllers/playerController');
const { authenticate, authorize, checkOwnership } = require('../middleware/auth');
const { generalAuthLimiter } = require('../middleware/rateLimiting');
const { validateProfileUpdate } = require('../middleware/advancedValidation');

const router = express.Router();

/**
 * Routes pour les joueurs NJCAA avec leurs dashboards et gestion de profil
 * 
 * Ces routes suivent le pattern établi dans votre application :
 * - Authentification obligatoire pour toutes les routes
 * - Autorisation basée sur les rôles 
 * - Validation des données avec Joi
 * - Rate limiting approprié
 * - Logging pour audit
 * 
 * Analogie : Pensez à ces routes comme un "espace personnel" pour chaque joueur,
 * comme un casier dans un vestiaire - seul le propriétaire (ou un admin) peut y accéder.
 */

// ========================
// ROUTES DE CONSULTATION (LECTURE SEULE)
// ========================

// GET /api/players/dashboard
// Dashboard principal du joueur avec profil complet et statistiques
router.get('/dashboard',
  authenticate, // Vérifier que l'utilisateur est connecté
  authorize('player'), // S'assurer que c'est bien un joueur
  generalAuthLimiter, // Protection rate limiting
  PlayerController.getDashboard
);

// GET /api/players/:playerId/profile
// Profil public d'un joueur spécifique (pour les coachs)
router.get('/:playerId/profile',
  authenticate,
  authorize(['player', 'coach', 'admin']), // Joueurs, coachs et admins peuvent voir
  generalAuthLimiter,
  PlayerController.getPlayerProfile
);

// GET /api/players/analytics
// Analytics personnelles du joueur connecté
router.get('/analytics',
  authenticate,
  authorize('player'),
  generalAuthLimiter,
  PlayerController.getPlayerAnalytics
);

// ========================
// ROUTES DE MODIFICATION
// ========================

// PUT /api/players/profile
// Mise à jour du profil du joueur connecté
router.put('/profile',
  authenticate,
  authorize('player'),
  generalAuthLimiter,
  validateProfileUpdate('player'), // Validation spécialisée pour joueurs
  PlayerController.updatePlayerProfile
);

// POST /api/players/profile/visibility
// Contrôler la visibilité du profil (public/privé)
router.post('/profile/visibility',
  authenticate,
  authorize('player'),
  generalAuthLimiter,
  PlayerController.toggleProfileVisibility
);

// ========================
// ROUTES ADMINISTRATIVES (POUR LES COACHS)
// ========================

// GET /api/players/search
// Recherche de joueurs (pour les coachs)
router.get('/search',
  authenticate,
  authorize(['coach', 'admin']),
  generalAuthLimiter,
  PlayerController.searchPlayers
);

// POST /api/players/:playerId/view
// Enregistrer une vue de profil (analytics)
router.post('/:playerId/view',
  authenticate,
  authorize(['coach', 'admin']),
  generalAuthLimiter,
  PlayerController.recordProfileView
);

// ========================
// ROUTE DE SANTÉ
// ========================

router.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Player routes are running',
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      dashboard: 'GET /api/players/dashboard',
      profile: 'GET /api/players/:playerId/profile',
      analytics: 'GET /api/players/analytics',
      updateProfile: 'PUT /api/players/profile',
      toggleVisibility: 'POST /api/players/profile/visibility',
      search: 'GET /api/players/search',
      recordView: 'POST /api/players/:playerId/view'
    }
  });
});

module.exports = router;