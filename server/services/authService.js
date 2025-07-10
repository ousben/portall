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
   * * 🎫 Générer une paire de tokens (access + refresh)
   * 
   * SÉCURITÉ : L'access token a une durée courte (1h) pour limiter l'exposition
   * en cas de compromission, tandis que le refresh token dure plus longtemps (7j)
   * pour éviter de redemander les credentials trop souvent.
   * 
   * Génère une paire de tokens (access + refresh)
   * @param {Object} user - L'objet utilisateur
   * @returns {Object} Objet contenant accessToken et refreshToken
   */
  static generateTokenPair(user) {
    try {
      // Vérifier que JWT_SECRET est configuré
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }

      // Payload minimal pour éviter les tokens trop volumineux
      const payload = {
        userId: user.id,
        email: user.email,
        userType: user.userType,
        isActive: user.isActive
      };

      // Générer l'access token (courte durée)
      const accessToken = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        {
          expiresIn: '1h',
          issuer: 'portall-api',
          audience: 'portall-client'
        }
      );

      // Générer le refresh token (longue durée)
      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        {
          expiresIn: '7d',
          issuer: 'portall-api',
          audience: 'portall-client'
        }
      );

      return {
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 heure en secondes
        tokenType: 'Bearer'
      };

    } catch (error) {
      console.error('Token generation error:', error);
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  /**
   * Vérifie et décode un token JWT
   * @param {string} token - Le token à vérifier
   * @returns {Object} Le payload décodé
   * @throws {Error} Si le token est invalide
   */
  static verifyToken(token) {
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }

      return jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'portall-api',
        audience: 'portall-client'
      });

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error(`Token verification failed: ${error.message}`);
      }
    }
  }

  /**
   * 🔄 Vérifier un refresh token
   */
  static verifyRefreshToken(refreshToken) {
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }

      return jwt.verify(refreshToken, process.env.JWT_SECRET, {
        issuer: 'portall-api',
        audience: 'portall-client'
      });

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      } else {
        throw new Error(`Refresh token verification failed: ${error.message}`);
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

    // Format attendu : "Bearer <token>"
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
   * 🔧 Décoder un token sans vérification (pour debug uniquement)
   */
  static decodeTokenUnsafe(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      console.error('Token decode error:', error);
      return null;
    }
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