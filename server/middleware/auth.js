// portall/server/middleware/auth.js

const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware d'authentification et d'autorisation étendu
 * 
 * MISE À JOUR MAJEURE : Support complet du type d'utilisateur 'njcaa_coach'
 * avec ses règles d'autorisation spécifiques.
 * 
 * Ce middleware gère maintenant quatre types d'utilisateurs distincts :
 * - 'player' : Joueurs NJCAA
 * - 'coach' : Coachs NCAA/NAIA (avec abonnements)
 * - 'njcaa_coach' : Coachs NJCAA (accès gratuit, évaluations)
 * - 'admin' : Administrateurs
 */

/**
 * Middleware d'authentification de base
 * 
 * Vérifie la validité du token JWT et charge les informations utilisateur.
 * Fonctionne de manière identique pour tous les types d'utilisateurs.
 */
const authenticate = async (req, res, next) => {
  try {
    // Extraire le token du header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const token = authHeader.substring(7); // Retirer "Bearer "

    // Vérifier et décoder le token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Access token expired',
          code: 'TOKEN_EXPIRED'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid access token',
          code: 'TOKEN_INVALID'
        });
      } else {
        throw jwtError;
      }
    }

    // Récupérer l'utilisateur complet depuis la base de données
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Vérifier que le compte est toujours actif
    if (!user.isActive) {
      return res.status(403).json({
        status: 'error',
        message: 'Account is not active',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Ajouter les informations utilisateur à la requête
    req.user = {
      id: user.id,
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified
    };

    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware d'autorisation par type d'utilisateur (ÉTENDU)
 * 
 * NOUVEAU : Support complet pour 'njcaa_coach' avec ses règles spécifiques.
 * 
 * @param {string|string[]} allowedTypes - Type(s) d'utilisateur autorisé(s)
 * @returns {Function} Middleware function
 */
const authorize = (allowedTypes) => {
  // Normaliser en tableau pour simplifier la logique
  const types = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];
  
  return (req, res, next) => {
    // Vérifier que l'utilisateur est authentifié
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Vérifier l'autorisation par type
    if (!types.includes(req.user.userType)) {
      return res.status(403).json({
        status: 'error',
        message: `Access denied. Required user type: ${types.join(' or ')}. Your type: ${req.user.userType}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredTypes: types,
        userType: req.user.userType
      });
    }

    next();
  };
};

/**
 * NOUVEAU : Middleware spécialisé pour les coachs NJCAA
 * 
 * Ce middleware vérifie spécifiquement l'accès aux fonctionnalités
 * réservées aux coachs NJCAA.
 */
const requireNJCAACoach = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.userType !== 'njcaa_coach') {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. This feature is only available to NJCAA coaches.',
      code: 'NJCAA_COACH_ACCESS_REQUIRED',
      userType: req.user.userType
    });
  }

  next();
};

/**
 * NOUVEAU : Middleware pour les fonctionnalités réservées aux coachs (tous types)
 * 
 * Permet l'accès aux coachs NCAA/NAIA ET aux coachs NJCAA.
 * Utile pour les fonctionnalités communes à tous les coachs.
 */
const requireAnyCoach = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const coachTypes = ['coach', 'njcaa_coach'];
  if (!coachTypes.includes(req.user.userType)) {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. This feature is only available to coaches.',
      code: 'COACH_ACCESS_REQUIRED',
      userType: req.user.userType,
      allowedTypes: coachTypes
    });
  }

  next();
};

/**
 * Middleware pour les fonctionnalités réservées aux admins (inchangé)
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.userType !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. Admin privileges required.',
      code: 'ADMIN_ACCESS_REQUIRED',
      userType: req.user.userType
    });
  }

  next();
};

/**
 * NOUVEAU : Middleware pour vérifier les permissions d'évaluation de joueurs
 * 
 * Ce middleware spécialisé vérifie que l'utilisateur a le droit d'évaluer
 * ou de consulter les évaluations de joueurs selon des règles métier complexes.
 */
const requirePlayerEvaluationAccess = (accessType = 'read') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Règles d'accès selon le type d'utilisateur et d'action
    switch (accessType) {
      case 'create':
      case 'update':
        // Seuls les coachs NJCAA peuvent créer/modifier des évaluations
        if (req.user.userType !== 'njcaa_coach') {
          return res.status(403).json({
            status: 'error',
            message: 'Only NJCAA coaches can create or update player evaluations',
            code: 'EVALUATION_CREATE_ACCESS_DENIED',
            userType: req.user.userType
          });
        }
        break;

      case 'read':
        // Coachs NJCAA (créateurs) et coachs NCAA/NAIA (lecteurs) peuvent lire
        const readAllowedTypes = ['njcaa_coach', 'coach', 'admin'];
        if (!readAllowedTypes.includes(req.user.userType)) {
          return res.status(403).json({
            status: 'error',
            message: 'Access denied. Only coaches and admins can view player evaluations',
            code: 'EVALUATION_READ_ACCESS_DENIED',
            userType: req.user.userType,
            allowedTypes: readAllowedTypes
          });
        }
        break;

      case 'delete':
        // Seuls les admins peuvent supprimer des évaluations
        if (req.user.userType !== 'admin') {
          return res.status(403).json({
            status: 'error',
            message: 'Only administrators can delete player evaluations',
            code: 'EVALUATION_DELETE_ACCESS_DENIED',
            userType: req.user.userType
          });
        }
        break;

      default:
        return res.status(400).json({
          status: 'error',
          message: 'Invalid access type specified',
          code: 'INVALID_ACCESS_TYPE'
        });
    }

    next();
  };
};

/**
 * Middleware utilitaire pour enrichir les informations utilisateur
 * 
 * Ajoute des métadonnées utiles selon le type d'utilisateur.
 * Utile pour la personnalisation de l'interface côté client.
 */
const enrichUserContext = async (req, res, next) => {
  if (!req.user) {
    return next(); // Pas d'utilisateur authentifié, continuer
  }

  try {
    // Enrichir le contexte selon le type d'utilisateur
    switch (req.user.userType) {
      case 'player':
        req.user.capabilities = ['profile_management', 'view_coach_searches'];
        req.user.subscriptionRequired = false;
        break;

      case 'coach':
        req.user.capabilities = ['player_search', 'advanced_filters', 'subscription_management'];
        req.user.subscriptionRequired = true;
        break;

      case 'njcaa_coach':
        // NOUVEAU : Capacités spécifiques aux coachs NJCAA
        req.user.capabilities = ['player_evaluation', 'team_management', 'evaluation_history'];
        req.user.subscriptionRequired = false; // Accès gratuit
        break;

      case 'admin':
        req.user.capabilities = ['user_management', 'system_administration', 'all_access'];
        req.user.subscriptionRequired = false;
        break;

      default:
        req.user.capabilities = [];
        req.user.subscriptionRequired = false;
    }

    // Ajouter des métadonnées temporelles
    req.user.sessionInfo = {
      authenticatedAt: new Date(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    };

    next();

  } catch (error) {
    console.error('Error enriching user context:', error);
    // Continuer même en cas d'erreur d'enrichissement
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  requireAdmin,
  requireNJCAACoach, // NOUVEAU
  requireAnyCoach, // NOUVEAU
  requirePlayerEvaluationAccess, // NOUVEAU
  enrichUserContext // NOUVEAU
};