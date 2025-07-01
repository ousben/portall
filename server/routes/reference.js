// portall/server/routes/reference.js

const express = require('express');
const ReferenceController = require('../controllers/referenceController');
const { authenticate, authorize } = require('../middleware/auth');
const { generalAuthLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

/**
 * Routes pour les données de référence
 * 
 * Ces routes servent les listes de colleges, divisions, etc.
 * Elles sont essentielles pour peupler les dropdowns des formulaires
 */

// Routes publiques pour les données de référence (utilisées dans les formulaires)

// GET /api/reference/njcaa-colleges
// Récupère la liste complète des colleges NJCAA
router.get('/njcaa-colleges', 
  generalAuthLimiter,
  ReferenceController.getNJCAAColleges
);

// GET /api/reference/ncaa-colleges
// Récupère la liste des colleges NCAA/NAIA avec filtrage optionnel par division
router.get('/ncaa-colleges',
  generalAuthLimiter,
  ReferenceController.getNCAColleges
);

// GET /api/reference/ncaa-colleges/:division
// Filtre les colleges par division spécifique
router.get('/ncaa-colleges/:division',
  generalAuthLimiter,
  ReferenceController.getNCACollegesByDivision
);

// Routes d'administration (pour gérer les données de référence)

// POST /api/reference/njcaa-colleges
// Ajouter un nouveau college NJCAA (admin seulement)
router.post('/njcaa-colleges',
  authenticate,
  authorize('admin'),
  ReferenceController.createNJCAACollege
);

// PUT /api/reference/njcaa-colleges/:id
// Modifier un college NJCAA existant (admin seulement)
router.put('/njcaa-colleges/:id',
  authenticate,
  authorize('admin'),
  ReferenceController.updateNJCAACollege
);

// POST /api/reference/ncaa-colleges
// Ajouter un nouveau college NCAA (admin seulement)
router.post('/ncaa-colleges',
  authenticate,
  authorize('admin'),
  ReferenceController.createNCAACollege
);

// Route de santé pour les services de référence
router.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Reference data service is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      njcaaColleges: 'GET /api/reference/njcaa-colleges',
      ncaaColleges: 'GET /api/reference/ncaa-colleges',
      ncaaCollegesByDivision: 'GET /api/reference/ncaa-colleges/:division',
      admin: {
        createNJCAACollege: 'POST /api/reference/njcaa-colleges',
        updateNJCAACollege: 'PUT /api/reference/njcaa-colleges/:id',
        createNCAACollege: 'POST /api/reference/ncaa-colleges'
      }
    }
  });
});

module.exports = router;