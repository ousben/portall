// server/services/authService.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * 🔧 Service d'authentification unifié pour tous les environnements
 * 
 * CORRECTION MAJEURE : Configuration JWT unifiée pour éviter les incohérences
 * entre génération et vérification des tokens.
 * 
 * Le problème précédent : AuthService utilisait config/auth.js pendant que
 * le middleware auth.js utilisait directement process.env.JWT_SECRET.
 * 
 * Solution : Centraliser la configuration JWT selon l'environnement.
 */

class AuthService {
  /**
   * Obtenir la configuration JWT selon l'environnement
   */
  static getJWTConfig() {
    if (process.env.NODE_ENV === 'test') {
      return {
        secret: 'test_jwt_secret_for_testing_only',
        expiresIn: '1h',
        refreshExpiresIn: '7d',
        issuer: 'portall-api',
        audience: 'portall-app'
      };
    }
    
    return {
      secret: process.env.JWT_SECRET || 'fallback_secret_for_development',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'portall-api',
      audience: 'portall-app'
    };
  }

  /**
   * Génère un token JWT pour un utilisateur
   * @param {Object} user - L'objet utilisateur
   * @param {string} tokenType - 'access' ou 'refresh'
   * @returns {string} Le token JWT signé
   */
  static generateToken(user, tokenType = 'access') {
    const jwtConfig = this.getJWTConfig();
    
    // Payload : les données qu'on veut stocker dans le token
    const payload = {
      userId: user.id,
      email: user.email,
      userType: user.userType,
      isActive: user.isActive,
      tokenType: tokenType
    };

    // Options du token
    const options = {
      expiresIn: tokenType === 'refresh' ? jwtConfig.refreshExpiresIn : jwtConfig.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      subject: user.id.toString()
    };

    // Signer le token avec la clé secrète unifiée
    return jwt.sign(payload, jwtConfig.secret, options);
  }

  /**
   * Génère une paire de tokens (access + refresh)
   * @param {Object} user - L'objet utilisateur
   * @returns {Object} Objet contenant accessToken et refreshToken
   */
  static generateTokenPair(user) {
    const jwtConfig = this.getJWTConfig();
    
    const accessToken = this.generateToken(user, 'access');
    const refreshToken = this.generateToken(user, 'refresh');

    return {
      accessToken,
      refreshToken,
      expiresIn: jwtConfig.expiresIn,
      tokenType: 'Bearer'
    };
  }

  /**
   * Vérifie et décode un token JWT
   * @param {string} token - Le token à vérifier
   * @returns {Object} Le payload décodé
   * @throws {Error} Si le token est invalide
   */
  static verifyToken(token) {
    const jwtConfig = this.getJWTConfig();
    
    try {
      // Vérifier et décoder le token avec la même configuration
      const decoded = jwt.verify(token, jwtConfig.secret, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience
      });

      return decoded;
    } catch (error) {
      // Différents types d'erreurs JWT
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not active');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Extrait le token du header Authorization
   * @param {string} authHeader - Le header Authorization
   * @returns {string|null} Le token extrait ou null
   */
  static extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    // Format attendu: "Bearer TOKEN_STRING"
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Génère un token sécurisé pour la vérification email ou reset password
   * @returns {string} Token aléatoire sécurisé
   */
  static generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Vérifie si un utilisateur a les permissions pour une action
   * @param {Object} user - L'utilisateur
   * @param {string} requiredRole - Le rôle requis
   * @returns {boolean} True si autorisé
   */
  static hasPermission(user, requiredRole) {
    const roleHierarchy = {
      'player': 1,
      'coach': 2,
      'njcaa_coach': 2, // Même niveau que coach normal
      'admin': 3
    };

    const userLevel = roleHierarchy[user.userType] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return userLevel >= requiredLevel;
  }

  /**
   * Décode un token sans le vérifier (utile pour déboguer)
   * @param {string} token - Le token à décoder
   * @returns {Object} Le payload décodé
   */
  static decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }
}

module.exports = AuthService;