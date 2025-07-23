// portall/server/tests/unit/services/AuthService.test.js

process.env.NODE_ENV = 'test';

const AuthService = require('../../../services/authService');
const jwt = require('jsonwebtoken');
const TestHelpers = require('../../utils/testHelpers');

/**
 * 🔐 Tests unitaires du service AuthService - Cœur de la sécurité
 * 
 * AuthService est le cerveau de votre système d'authentification. Il gère
 * la génération, validation et gestion des tokens JWT qui sécurisent votre API.
 * Ces tests garantissent que votre système de sécurité fonctionne correctement
 * dans tous les scénarios possibles.
 * 
 * 🎯 Concept pédagogique : "Security by Design Testing"
 * Tester la sécurité signifie vérifier non seulement les cas normaux,
 * mais aussi tous les cas d'attaque possibles. C'est comme tester une
 * serrure : vous vérifiez qu'elle s'ouvre avec la bonne clé ET qu'elle
 * résiste aux tentatives d'effraction.
 * 
 * 💡 Architecture de sécurité testée :
 * - Génération de tokens avec payload correct
 * - Validation de signature et expiration
 * - Gestion des différents types de tokens (access/refresh)
 * - Configuration uniforme entre environnements
 */

describe('🔐 AuthService - Security Foundation Tests', () => {

  describe('⚙️ JWT Configuration Management', () => {
    test('Should use test configuration in test environment', () => {
      const config = AuthService.getJWTConfig();
      
      expect(config.secret).toBe('test_jwt_secret_for_testing_only');
      expect(config.expiresIn).toBe('1h');
      expect(config.refreshExpiresIn).toBe('7d');
      expect(config.issuer).toBe('portall-api');
      expect(config.audience).toBe('portall-app');
    });

    test('Should provide consistent configuration', () => {
      const config1 = AuthService.getJWTConfig();
      const config2 = AuthService.getJWTConfig();
      
      expect(config1).toEqual(config2);
      expect(config1.secret).toBe(config2.secret);
    });

    test('Should handle different environments appropriately', () => {
      // Sauvegarder l'environnement actuel
      const originalEnv = process.env.NODE_ENV;
      
      try {
        // Tester configuration de production
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'production_secret';
        
        const prodConfig = AuthService.getJWTConfig();
        expect(prodConfig.secret).toBe('production_secret');
        
        // Nettoyer
        delete process.env.JWT_SECRET;
        
      } finally {
        // Restaurer l'environnement de test
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('🎫 Token Generation', () => {
    let testUser;

    beforeEach(async () => {
      const userData = await TestHelpers.createTestPlayer();
      testUser = userData.user;
    });

    test('Should generate valid access token with correct payload', () => {
      const token = AuthService.generateToken(testUser, 'access');
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // Header.Payload.Signature
      
      // Décoder le token pour vérifier le payload
      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.userType).toBe(testUser.userType);
      expect(decoded.isActive).toBe(testUser.isActive);
      expect(decoded.tokenType).toBe('access');
    });

    test('Should generate valid refresh token with extended expiration', () => {
      const refreshToken = AuthService.generateToken(testUser, 'refresh');
      
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
      
      const decoded = jwt.decode(refreshToken);
      expect(decoded.tokenType).toBe('refresh');
      expect(decoded.userId).toBe(testUser.id);
      
      // Le refresh token devrait avoir une expiration plus longue
      const now = Math.floor(Date.now() / 1000);
      const sevenDaysFromNow = now + (7 * 24 * 60 * 60);
      expect(decoded.exp).toBeGreaterThan(now + (6 * 24 * 60 * 60)); // Au moins 6 jours
      expect(decoded.exp).toBeLessThanOrEqual(sevenDaysFromNow + 60); // Tolérance d'une minute
    });

    test('Should include proper JWT claims', () => {
      const token = AuthService.generateToken(testUser);
      const decoded = jwt.decode(token);
      
      expect(decoded.iss).toBe('portall-api'); // Issuer
      expect(decoded.aud).toBe('portall-app'); // Audience
      expect(decoded.sub).toBe(testUser.id.toString()); // Subject
      expect(decoded.exp).toBeDefined(); // Expiration
      expect(decoded.iat).toBeDefined(); // Issued at
    });

    test('Should generate different tokens for different users', () => {
      const user1Token = AuthService.generateToken(testUser);
      
      // Créer un second utilisateur
      const user2Data = {
        id: testUser.id + 1,
        email: 'different@example.com',
        userType: 'coach',
        isActive: true
      };
      
      const user2Token = AuthService.generateToken(user2Data);
      
      expect(user1Token).not.toBe(user2Token);
      
      const decoded1 = jwt.decode(user1Token);
      const decoded2 = jwt.decode(user2Token);
      
      expect(decoded1.userId).not.toBe(decoded2.userId);
      expect(decoded1.email).not.toBe(decoded2.email);
      expect(decoded1.userType).not.toBe(decoded2.userType);
    });

    test('Should handle edge cases in user data', () => {
      // Utilisateur avec données minimales
      const minimalUser = {
        id: 999,
        email: 'minimal@example.com',
        userType: 'admin',
        isActive: false
      };
      
      const token = AuthService.generateToken(minimalUser);
      const decoded = jwt.decode(token);
      
      expect(decoded.userId).toBe(999);
      expect(decoded.isActive).toBe(false);
      expect(decoded.userType).toBe('admin');
    });
  });

  describe('🎭 Token Pair Generation', () => {
    let testUser;

    beforeEach(async () => {
      const userData = await TestHelpers.createTestNJCAACoach();
      testUser = userData.user;
    });

    test('Should generate valid token pair', () => {
      const tokenPair = AuthService.generateTokenPair(testUser);
      
      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(typeof tokenPair.refreshToken).toBe('string');
      expect(tokenPair.accessToken).not.toBe(tokenPair.refreshToken);
    });

    test('Should create tokens with different expiration times', () => {
      const tokenPair = AuthService.generateTokenPair(testUser);
      
      const accessDecoded = jwt.decode(tokenPair.accessToken);
      const refreshDecoded = jwt.decode(tokenPair.refreshToken);
      
      // Le refresh token devrait expirer après l'access token
      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp);
    });

    test('Should include correct token types in pair', () => {
      const tokenPair = AuthService.generateTokenPair(testUser);
      
      const accessDecoded = jwt.decode(tokenPair.accessToken);
      const refreshDecoded = jwt.decode(tokenPair.refreshToken);
      
      expect(accessDecoded.tokenType).toBe('access');
      expect(refreshDecoded.tokenType).toBe('refresh');
    });

    test('Should maintain user consistency across token pair', () => {
      const tokenPair = AuthService.generateTokenPair(testUser);
      
      const accessDecoded = jwt.decode(tokenPair.accessToken);
      const refreshDecoded = jwt.decode(tokenPair.refreshToken);
      
      expect(accessDecoded.userId).toBe(refreshDecoded.userId);
      expect(accessDecoded.email).toBe(refreshDecoded.email);
      expect(accessDecoded.userType).toBe(refreshDecoded.userType);
    });
  });

  describe('✅ Token Verification', () => {
    let testUser;
    let validToken;

    beforeEach(async () => {
      const userData = await TestHelpers.createTestCoach();
      testUser = userData.user;
      validToken = AuthService.generateToken(testUser);
    });

    test('Should verify valid token successfully', () => {
      const verified = AuthService.verifyToken(validToken);
      
      expect(verified).toBeDefined();
      expect(verified.userId).toBe(testUser.id);
      expect(verified.email).toBe(testUser.email);
      expect(verified.userType).toBe(testUser.userType);
    });

    test('Should reject invalid signature', () => {
      // Modifier le token pour corrompre la signature
      const corruptedToken = validToken.slice(0, -10) + 'corrupted';
      
      expect(() => {
        AuthService.verifyToken(corruptedToken);
      }).toThrow();
    });

    test('Should reject malformed tokens', () => {
      const malformedTokens = [
        'not.a.token',
        'invalid',
        '',
        null,
        undefined,
        'header.payload', // Manque la signature
        'too.many.parts.here.error'
      ];

      malformedTokens.forEach(token => {
        expect(() => {
          AuthService.verifyToken(token);
        }).toThrow();
      });
    });

    test('Should reject expired tokens', () => {
      // Créer un token avec une expiration dans le passé
      const config = AuthService.getJWTConfig();
      const expiredToken = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          userType: testUser.userType,
          exp: Math.floor(Date.now() / 1000) - 3600 // Expiré il y a 1 heure
        },
        config.secret
      );

      expect(() => {
        AuthService.verifyToken(expiredToken);
      }).toThrow();
    });

    test('Should verify token with correct issuer and audience', () => {
      const verified = AuthService.verifyToken(validToken);
      
      expect(verified.iss).toBe('portall-api');
      expect(verified.aud).toBe('portall-app');
    });

    test('Should reject tokens with wrong secret', () => {
      // Créer un token avec un secret différent
      const tokenWithWrongSecret = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          userType: testUser.userType
        },
        'wrong_secret',
        { expiresIn: '1h' }
      );

      expect(() => {
        AuthService.verifyToken(tokenWithWrongSecret);
      }).toThrow();
    });
  });

  describe('🔄 Token Refresh Logic', () => {
    let testUser;
    let refreshToken;

    beforeEach(async () => {
      const userData = await TestHelpers.createTestAdmin();
      testUser = userData.user;
      const tokenPair = AuthService.generateTokenPair(testUser);
      refreshToken = tokenPair.refreshToken;
    });

    test('Should refresh tokens with valid refresh token', () => {
      const newTokenPair = AuthService.refreshTokens(refreshToken);
      
      expect(newTokenPair).toHaveProperty('accessToken');
      expect(newTokenPair).toHaveProperty('refreshToken');
      expect(newTokenPair.accessToken).not.toBe(refreshToken);
      expect(newTokenPair.refreshToken).not.toBe(refreshToken);
    });

    test('Should maintain user data in refreshed tokens', () => {
      const newTokenPair = AuthService.refreshTokens(refreshToken);
      
      const accessDecoded = jwt.decode(newTokenPair.accessToken);
      const refreshDecoded = jwt.decode(newTokenPair.refreshToken);
      
      expect(accessDecoded.userId).toBe(testUser.id);
      expect(accessDecoded.email).toBe(testUser.email);
      expect(accessDecoded.userType).toBe(testUser.userType);
      expect(refreshDecoded.userId).toBe(testUser.id);
    });

    test('Should reject refresh with access token', () => {
      const accessToken = AuthService.generateToken(testUser, 'access');
      
      expect(() => {
        AuthService.refreshTokens(accessToken);
      }).toThrow();
    });

    test('Should reject expired refresh token', () => {
      const config = AuthService.getJWTConfig();
      const expiredRefreshToken = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          userType: testUser.userType,
          tokenType: 'refresh',
          exp: Math.floor(Date.now() / 1000) - 3600
        },
        config.secret
      );

      expect(() => {
        AuthService.refreshTokens(expiredRefreshToken);
      }).toThrow();
    });
  });

  describe('🔒 Security Edge Cases', () => {
    test('Should handle null or undefined user gracefully', () => {
      expect(() => {
        AuthService.generateToken(null);
      }).toThrow();

      expect(() => {
        AuthService.generateToken(undefined);
      }).toThrow();
    });

    test('Should handle user with missing required fields', () => {
      const incompleteUser = {
        id: 123,
        // email manquant
        userType: 'player'
        // isActive manquant
      };

      // Devrait générer un token même avec des champs manquants
      // car c'est au niveau de la validation des données qu'on gère cela
      const token = AuthService.generateToken(incompleteUser);
      const decoded = jwt.decode(token);
      
      expect(decoded.userId).toBe(123);
      expect(decoded.email).toBeUndefined();
      expect(decoded.userType).toBe('player');
      expect(decoded.isActive).toBeUndefined();
    });

    test('Should generate unique tokens for same user at different times', async () => {
      const userData = await TestHelpers.createTestPlayer();
      const user = userData.user;
      
      const token1 = AuthService.generateToken(user);
      
      // Attendre un peu pour changer le timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const token2 = AuthService.generateToken(user);
      
      expect(token1).not.toBe(token2);
      
      const decoded1 = jwt.decode(token1);
      const decoded2 = jwt.decode(token2);
      
      // Même utilisateur mais timestamps différents
      expect(decoded1.userId).toBe(decoded2.userId);
      expect(decoded1.iat).not.toBe(decoded2.iat);
    });

    test('Should handle concurrent token generation', async () => {
      const userData = await TestHelpers.createTestPlayer();
      const user = userData.user;
      
      // Générer plusieurs tokens simultanément
      const tokenPromises = Array(10).fill().map(() => 
        Promise.resolve(AuthService.generateToken(user))
      );
      
      const tokens = await Promise.all(tokenPromises);
      
      // Tous les tokens doivent être valides et uniques
      expect(new Set(tokens).size).toBe(10); // Tous différents
      
      tokens.forEach(token => {
        const decoded = jwt.decode(token);
        expect(decoded.userId).toBe(user.id);
      });
    });
  });

  describe('⚡ Performance and Reliability', () => {
    test('Should generate tokens efficiently', () => {
      const userData = {
        id: 1,
        email: 'performance@example.com',
        userType: 'player',
        isActive: true
      };
      
      const startTime = Date.now();
      
      // Générer 100 tokens
      for (let i = 0; i < 100; i++) {
        AuthService.generateToken(userData);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Génération de 100 tokens devrait prendre moins d'une seconde
      expect(duration).toBeLessThan(1000);
    });

    test('Should verify tokens efficiently', () => {
      const userData = {
        id: 1,
        email: 'verify@example.com',
        userType: 'coach',
        isActive: true
      };
      
      const token = AuthService.generateToken(userData);
      const startTime = Date.now();
      
      // Vérifier 100 fois le même token
      for (let i = 0; i < 100; i++) {
        AuthService.verifyToken(token);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Vérification de 100 tokens devrait prendre moins d'une seconde
      expect(duration).toBeLessThan(1000);
    });
  });
});