// portall/server/routes/auth.js - VERSION MISE À JOUR

const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter, generalAuthLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiting');
const { validateRegistration } = require('../middleware/advancedValidation'); // NOUVEAU
const { 
  validate, 
  loginSchema, 
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema 
} = require('../validators/authValidators');

const router = express.Router();

/**
 * Routes d'authentification mises à jour pour la Phase 3
 * 
 * La principale différence est l'utilisation du nouveau middleware
 * de validation avancé pour l'inscription.
 */

// POST /api/auth/register - MISE À JOUR
// Inscription avec validation conditionnelle selon le type d'utilisateur
router.post('/register', 
  authLimiter,
  validateRegistration, // NOUVEAU : Remplace l'ancien validate(registerSchema)
  AuthController.register
);

// Les autres routes restent identiques
router.post('/login',
  authLimiter,
  validate(loginSchema),
  AuthController.login
);

router.post('/refresh',
  generalAuthLimiter,
  validate(refreshTokenSchema),
  AuthController.refresh
);

router.post('/logout',
  authenticate,
  AuthController.logout
);

router.get('/me',
  authenticate,
  AuthController.getMe
);

router.post('/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  AuthController.forgotPassword
);

router.post('/reset-password',
  generalAuthLimiter,
  validate(resetPasswordSchema),
  AuthController.resetPassword
);

// Route de santé inchangée
router.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Auth service is running',
    timestamp: new Date().toISOString(),
    validation: {
      version: '3.0',
      features: [
        'Conditional validation by user type',
        'Async database validations',
        'Cross-field business logic validation',
        'Enhanced error reporting'
      ]
    },
    endpoints: {
      register: 'POST /api/auth/register (enhanced validation)',
      login: 'POST /api/auth/login',
      refresh: 'POST /api/auth/refresh',
      logout: 'POST /api/auth/logout',
      me: 'GET /api/auth/me',
      forgotPassword: 'POST /api/auth/forgot-password',
      resetPassword: 'POST /api/auth/reset-password'
    }
  });
});

module.exports = router;