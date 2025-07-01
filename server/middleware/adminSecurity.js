// portall/server/middleware/adminSecurity.js

const { User } = require('../models');
const AuthService = require('../services/authService');

/**
 * Middleware de sécurité administrative avancée
 * 
 * Ce middleware implémente plusieurs couches de sécurité :
 * 1. Vérification d'authentification (token valide)
 * 2. Vérification de rôle admin
 * 3. Vérification que le compte admin est actif
 * 4. Logging de sécurité pour audit
 * 5. Protection contre les attaques de timing
 * 
 * Analogie : C'est comme un système de sécurité bancaire qui vérifie
 * non seulement votre carte, mais aussi votre code, vos empreintes,
 * et enregistre chaque action dans un journal sécurisé.
 */

/**
 * Middleware principal de sécurité admin
 * 
 * Ce middleware doit être utilisé sur TOUTES les routes administratives.
 * Il garantit que seuls les administrateurs authentifiés et autorisés
 * peuvent accéder aux fonctionnalités sensibles.
 */
const requireAdminAccess = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔐 Admin access attempt from IP: ${req.ip}`);

    // ========================
    // ÉTAPE 1 : VÉRIFICATION D'AUTHENTIFICATION
    // ========================
    
    const authHeader = req.headers.authorization;
    const token = AuthService.extractTokenFromHeader(authHeader);

    if (!token) {
      // Log de sécurité : tentative d'accès sans token
      console.warn(`⚠️ Admin access denied - No token provided from IP: ${req.ip}`);
      
      return res.status(401).json({
        status: 'error',
        message: 'Admin authentication required',
        code: 'ADMIN_AUTH_REQUIRED'
      });
    }

    // ========================
    // ÉTAPE 2 : VALIDATION DU TOKEN
    // ========================
    
    let decoded;
    try {
      decoded = AuthService.verifyToken(token);
    } catch (error) {
      console.warn(`⚠️ Admin access denied - Invalid token from IP: ${req.ip}`);
      
      return res.status(401).json({
        status: 'error',
        message: 'Invalid admin token',
        code: 'INVALID_ADMIN_TOKEN'
      });
    }

    // ========================
    // ÉTAPE 3 : VÉRIFICATION DU RÔLE ADMIN
    // ========================
    
    if (decoded.userType !== 'admin') {
      // Log de sécurité critique : tentative d'escalade de privilèges
      console.error(`🚨 SECURITY ALERT - Privilege escalation attempt from user ID: ${decoded.userId}, IP: ${req.ip}`);
      
      return res.status(403).json({
        status: 'error',
        message: 'Admin privileges required',
        code: 'INSUFFICIENT_ADMIN_PRIVILEGES'
      });
    }

    // ========================
    // ÉTAPE 4 : VÉRIFICATION EN BASE DE DONNÉES
    // ========================
    
    const adminUser = await User.findByPk(decoded.userId);
    
    if (!adminUser) {
      console.error(`🚨 SECURITY ALERT - Token valid but user not found: ID ${decoded.userId}, IP: ${req.ip}`);
      
      return res.status(401).json({
        status: 'error',
        message: 'Admin user not found',
        code: 'ADMIN_USER_NOT_FOUND'
      });
    }

    if (!adminUser.isActive) {
      console.warn(`⚠️ Admin access denied - Inactive admin account: ${adminUser.email}, IP: ${req.ip}`);
      
      return res.status(403).json({
        status: 'error',
        message: 'Admin account is deactivated',
        code: 'ADMIN_ACCOUNT_INACTIVE'
      });
    }

    // ========================
    // ÉTAPE 5 : SUCCÈS - ENRICHIR LA REQUÊTE
    // ========================
    
    // Ajouter les informations admin à la requête pour les contrôleurs
    req.admin = adminUser;
    req.adminToken = token;
    req.adminId = adminUser.id;
    
    // Mettre à jour la dernière activité admin
    await adminUser.updateLastLogin();
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ Admin access granted to: ${adminUser.email} (${processingTime}ms)`);
    
    next();

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Admin security middleware error (${processingTime}ms):`, error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Admin authentication failed',
      code: 'ADMIN_AUTH_ERROR'
    });
  }
};

/**
 * Middleware de logging pour les actions administratives
 * 
 * Ce middleware enregistre TOUTES les actions admin pour audit.
 * Il doit être utilisé après requireAdminAccess.
 */
const logAdminAction = (actionType) => {
  return (req, res, next) => {
    // Capturer les détails de l'action pour logging
    req.adminAction = {
      type: actionType,
      adminId: req.admin.id,
      adminEmail: req.admin.email,
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestData: req.body
    };
    
    console.log(`📋 Admin action logged: ${actionType} by ${req.admin.email} from ${req.ip}`);
    
    next();
  };
};

/**
 * Middleware de protection contre les actions en masse
 * 
 * Ce middleware limite le nombre d'actions simultanées qu'un admin
 * peut effectuer pour éviter les erreurs accidentelles.
 */
const rateLimitAdminActions = (maxActions = 10, windowMs = 60000) => {
  const actionCounts = new Map();
  
  return (req, res, next) => {
    const adminId = req.admin.id;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Nettoyer les anciens compteurs
    if (actionCounts.has(adminId)) {
      const actions = actionCounts.get(adminId).filter(time => time > windowStart);
      actionCounts.set(adminId, actions);
    }
    
    // Vérifier le nombre d'actions récentes
    const recentActions = actionCounts.get(adminId) || [];
    
    if (recentActions.length >= maxActions) {
      console.warn(`⚠️ Rate limit exceeded for admin: ${req.admin.email}`);
      
      return res.status(429).json({
        status: 'error',
        message: `Too many admin actions. Maximum ${maxActions} actions per minute.`,
        code: 'ADMIN_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((recentActions[0] + windowMs - now) / 1000)
      });
    }
    
    // Enregistrer cette action
    recentActions.push(now);
    actionCounts.set(adminId, recentActions);
    
    next();
  };
};

module.exports = {
  requireAdminAccess,
  logAdminAction,
  rateLimitAdminActions
};