// portall/server/routes/auth.js

const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter, generalAuthLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiting');
const { 
  validate, 
  registerSchema, 
  loginSchema, 
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema 
} = require('../validators/authValidators');

const router = express.Router();

/**
 * Routes d'authentification
 * 
 * Chaque route est comme une station dans un processus de sécurité :
 * - Validation des données (contrôle des papiers)
 * - Rate limiting (contrôle du flux)
 * - Logique métier (traitement)
 */

// POST /api/auth/register
// Inscription d'un nouvel utilisateur
router.post('/register', 
  authLimiter, // Protection contre les inscriptions en masse
  validate(registerSchema), // Validation des données
  AuthController.register
);

// POST /api/auth/login
// Connexion d'un utilisateur
router.post('/login',
  authLimiter, // Protection contre les attaques par force brute
  validate(loginSchema), // Validation email/password
  AuthController.login
);

// POST /api/auth/refresh
// Rafraîchissement des tokens
router.post('/refresh',
  generalAuthLimiter, // Rate limiting plus permissif
  validate(refreshTokenSchema), // Validation du refresh token
  AuthController.refresh
);

// POST /api/auth/logout
// Déconnexion (nécessite d'être authentifié)
router.post('/logout',
  authenticate, // L'utilisateur doit être connecté pour se déconnecter
  AuthController.logout
);

// GET /api/auth/me
// Obtenir le profil de l'utilisateur connecté
router.get('/me',
  authenticate, // Nécessite d'être authentifié
  AuthController.getMe
);

// POST /api/auth/forgot-password
// Demande de reset de mot de passe
router.post('/forgot-password',
  forgotPasswordLimiter, // Rate limiting très strict
  validate(forgotPasswordSchema), // Validation email
  AuthController.forgotPassword
);

// POST /api/auth/reset-password
// Reset du mot de passe avec token
router.post('/reset-password',
  generalAuthLimiter, // Rate limiting modéré
  validate(resetPasswordSchema), // Validation token + password
  AuthController.resetPassword
);

// Route de santé pour les auth services
router.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Auth service is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      register: 'POST /api/auth/register',
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