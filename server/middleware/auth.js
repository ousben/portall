// portall/server/middleware/auth.js

const AuthService = require('../services/authService');
const { User } = require('../models');

/**
 * Middleware d'authentification principal
 * Vérifie le token JWT et charge l'utilisateur
 */
const authenticate = async (req, res, next) => {
  try {
    // 1. Extraire le token du header Authorization
    const authHeader = req.headers.authorization;
    const token = AuthService.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access token required'
      });
    }

    // 2. Vérifier le token
    let decoded;
    try {
      decoded = AuthService.verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        status: 'error',
        message: error.message
      });
    }

    // 3. Vérifier que c'est un access token (pas un refresh token)
    if (decoded.tokenType === 'refresh') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token type'
      });
    }

    // 4. Charger l'utilisateur depuis la base de données
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // 5. Vérifier que l'utilisateur est toujours actif
    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Account deactivated'
      });
    }

    // 6. Ajouter l'utilisateur à la requête pour les prochains middlewares
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Authentication failed'
    });
  }
};

/**
 * Middleware pour vérifier les rôles
 * @param {string|Array} roles - Le(s) rôle(s) autorisé(s)
 */
const authorize = (roles) => {
  // Normaliser les rôles en array
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    // Vérifier que l'utilisateur est authentifié
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Vérifier le rôle
    if (!allowedRoles.includes(req.user.userType)) {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Middleware optionnel d'authentification
 * N'échoue pas si pas de token, mais charge l'utilisateur si présent
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = AuthService.extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = AuthService.verifyToken(token);
      const user = await User.findByPk(decoded.userId);
      
      if (user && user.isActive) {
        req.user = user;
        req.token = token;
      }
    }
  } catch (error) {
    // On ignore les erreurs en mode optionnel
    console.log('Optional auth failed:', error.message);
  }

  next();
};

/**
 * Middleware pour vérifier que l'utilisateur accède à ses propres données
 * ou qu'il a les permissions d'admin
 */
const checkOwnership = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const requestedUserId = parseInt(req.params[userIdParam]);
    const currentUserId = req.user.id;

    // Admin peut accéder à tout
    if (req.user.userType === 'admin') {
      return next();
    }

    // L'utilisateur peut accéder à ses propres données
    if (currentUserId === requestedUserId) {
      return next();
    }

    return res.status(403).json({
      status: 'error',
      message: 'Access denied'
    });
  };
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
  checkOwnership
};