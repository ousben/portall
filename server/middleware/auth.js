// portall/server/middleware/auth.js

const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware d'authentification et d'autorisation étendu pour Phase 5
 * 
 * EXPLICATION PÉDAGOGIQUE : Ce middleware illustre parfaitement le concept de sécurité
 * multicouche. Comme un système de sécurité d'aéroport, il vérifie d'abord l'identité
 * (authentification), puis les permissions d'accès (autorisation), et enfin les
 * autorisations spécifiques selon le contexte (contrôles métier).
 * 
 * MISE À JOUR MAJEURE : Support complet du type d'utilisateur 'njcaa_coach'
 * avec ses règles d'autorisation spécifiques :
 * - Accès gratuit (pas d'abonnement Stripe)
 * - Fonctionnalités d'évaluation de joueurs
 * - Dashboard simplifié par rapport aux coachs NCAA/NAIA
 * 
 * Cette extension démontre comment ajouter de nouvelles fonctionnalités de sécurité
 * sans compromettre les mesures existantes.
 */

/**
 * Middleware d'authentification de base
 * 
 * CONCEPT PÉDAGOGIQUE : Cette fonction est le gardien de votre API. Elle vérifie
 * que chaque requête provient d'un utilisateur authentifié valide. C'est comme
 * vérifier un passeport à la frontière - nous validons l'identité avant d'autoriser
 * l'entrée dans le système.
 * 
 * ROBUSTESSE : Cette méthode fonctionne de manière identique pour tous les types
 * d'utilisateurs, démontrant la solidité de l'architecture basée sur JWT.
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

    // Ajouter les informations utilisateur à la requête (étendu pour njcaa_coach)
    req.user = {
      id: user.id,
      email: user.email,
      userType: user.userType, // Maintenant inclut 'njcaa_coach'
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
 * CONCEPT PÉDAGOGIQUE : Si l'authentification répond à "Qui êtes-vous ?",
 * l'autorisation répond à "Que pouvez-vous faire ?". Cette fonction vérifie
 * que l'utilisateur authentifié a le bon "badge d'accès" pour la ressource demandée.
 * 
 * EXTENSIBILITÉ : L'ajout du type 'njcaa_coach' se fait naturellement grâce
 * à l'architecture basée sur des tableaux et des comparaisons de chaînes.
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

    // Vérifier l'autorisation par type (maintenant étendu pour njcaa_coach)
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
 * EXPLICATION PÉDAGOGIQUE : Ce middleware montre comment créer des contrôles d'accès
 * très spécifiques. Plutôt que d'utiliser le middleware générique authorize(),
 * nous créons une fonction dédiée qui peut inclure des vérifications métier
 * spécifiques aux coachs NJCAA.
 * 
 * USAGE : Utilisé dans les routes qui sont exclusivement réservées aux coachs NJCAA,
 * comme les fonctionnalités d'évaluation de joueurs.
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
 * NOUVEAU : Middleware pour les fonctionnalités communes à tous les coachs
 * 
 * CONCEPT D'ABSTRACTION : Ce middleware reconnaît que malgré leurs différences,
 * les coachs NCAA/NAIA et NJCAA partagent certaines fonctionnalités communes.
 * C'est un excellent exemple de généralisation en programmation.
 * 
 * USAGE : Pour les fonctionnalités qui concernent tous les types de coachs,
 * comme consulter des profils de joueurs ou gérer leurs paramètres de base.
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
 * 
 * STABILITÉ : Cette fonction illustre comment les bonnes abstractions résistent
 * au temps. Malgré l'ajout d'un nouveau type d'utilisateur, la logique admin
 * reste parfaitement stable.
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
 * NOUVEAU : Middleware pour les permissions d'évaluation de joueurs
 * 
 * EXPLICATION PÉDAGOGIQUE : Ce middleware illustre le concept de permissions granulaires.
 * Différents types d'utilisateurs ont différents niveaux d'accès à la même ressource.
 * C'est comme un système de bibliothèque où certains peuvent lire, d'autres écrire,
 * et d'autres administrer.
 * 
 * RÈGLES MÉTIER COMPLEXES :
 * - Créer/Modifier : Seuls les coachs NJCAA (propriétaires des évaluations)
 * - Lire : Coachs NJCAA + Coachs NCAA/NAIA (consommateurs des évaluations) + Admins
 * - Supprimer : Seuls les admins (pour modération)
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
 * CONCEPT PÉDAGOGIQUE : Ce middleware montre comment ajouter des métadonnées
 * contextuelles à une requête. Il enrichit l'objet req.user avec des informations
 * sur les capacités et permissions de l'utilisateur selon son type.
 * 
 * PERSONNALISATION : Ces métadonnées permettent au frontend d'adapter
 * dynamiquement l'interface selon les permissions de l'utilisateur.
 */
const enrichUserContext = async (req, res, next) => {
  if (!req.user) {
    return next(); // Pas d'utilisateur authentifié, continuer
  }

  try {
    // Enrichir le contexte selon le type d'utilisateur (étendu pour njcaa_coach)
    switch (req.user.userType) {
      case 'player':
        req.user.capabilities = ['profile_management', 'view_coach_searches'];
        req.user.subscriptionRequired = false;
        req.user.dashboardRoute = '/player/dashboard';
        break;

      case 'coach':
        req.user.capabilities = ['player_search', 'advanced_filters', 'subscription_management'];
        req.user.subscriptionRequired = true;
        req.user.dashboardRoute = '/coach/dashboard';
        break;

      case 'njcaa_coach':
        // NOUVEAU : Capacités spécifiques aux coachs NJCAA
        req.user.capabilities = ['player_evaluation', 'team_management', 'evaluation_history'];
        req.user.subscriptionRequired = false; // Accès gratuit
        req.user.dashboardRoute = '/njcaa-coach/dashboard';
        break;

      case 'admin':
        req.user.capabilities = ['user_management', 'system_administration', 'all_access'];
        req.user.subscriptionRequired = false;
        req.user.dashboardRoute = '/admin/dashboard';
        break;

      default:
        req.user.capabilities = [];
        req.user.subscriptionRequired = false;
        req.user.dashboardRoute = '/';
    }

    // Ajouter des métadonnées temporelles utiles
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

// EXPORT ÉTENDU avec toutes les nouvelles fonctions
module.exports = {
  authenticate,
  authorize,
  requireAdmin,
  requireNJCAACoach, // NOUVEAU
  requireAnyCoach, // NOUVEAU
  requirePlayerEvaluationAccess, // NOUVEAU
  enrichUserContext // ÉTENDU
};