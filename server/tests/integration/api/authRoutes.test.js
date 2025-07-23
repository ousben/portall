// portall/server/tests/integration/api/authRoutes.test.js

process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../../server');
const TestHelpers = require('../../utils/testHelpers');
const { User, PlayerProfile, CoachProfile, NJCAACoachProfile } = require('../../../models');

/**
 * 🛣️ Tests d'intégration des routes d'authentification - Workflows complets
 * 
 * Ces tests valident l'ensemble du pipeline d'authentification, depuis la réception
 * de la requête HTTP jusqu'à la réponse finale, en passant par tous les middleware,
 * contrôleurs et services impliqués.
 * 
 * 🎯 Concept pédagogique : "End-to-End Integration Testing"
 * L'intégration teste comment vos modules travaillent ensemble. C'est comme
 * tester un orchestre : chaque musicien (composant) peut être excellent
 * individuellement, mais l'harmonie d'ensemble (intégration) détermine
 * la qualité du concert final.
 * 
 * 💡 Pipeline d'authentification testé :
 * 1. Réception requête HTTP → Middleware CORS/Security
 * 2. Validation des données → Middleware de validation
 * 3. Logique métier → AuthController
 * 4. Manipulation de données → Models Sequelize
 * 5. Réponse formatée → Client
 * 
 * 🔧 Architecture de test :
 * - Tests avec SuperTest pour simulation HTTP complète
 * - Base de données réelle en environnement de test
 * - Validation des effets de bord (emails, tokens, etc.)
 */

describe('🛣️ Auth Routes Integration - Phase 5A & 5B Complete Workflows', () => {
  let testCollege;

  beforeAll(async () => {
    testCollege = await TestHelpers.createTestNJCAACollege();
  });

  beforeEach(async () => {
    await TestHelpers.cleanupTestData();
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('🏥 Health Check Routes', () => {
    test('Should return API health status', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('Auth service');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('environment', 'test');
    });

    test('Should include service dependencies in health check', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.body.data).toHaveProperty('database');
      expect(response.body.data).toHaveProperty('emailService');
      expect(response.body.data.database.connected).toBe(true);
    });
  });

  describe('📝 User Registration Workflows', () => {
    describe('👤 Player Registration', () => {
      test('Should register player with complete profile successfully', async () => {
        const registrationData = {
          user: {
            email: 'integration.player@example.com',
            password: 'SecurePassword123!',
            firstName: 'Integration',
            lastName: 'Player',
            userType: 'player'
          },
          profile: {
            dateOfBirth: '2003-01-15',
            height: 175,
            weight: 70,
            position: 'midfielder',
            gender: 'male',
            collegeId: testCollege.id,
            currentYear: 'freshman',
            graduationYear: 2026,
            gpa: 3.5
          }
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(registrationData)
          .expect(201);

        // Vérifier la structure de la réponse
        TestHelpers.expectValidJWTResponse(response);
        expect(response.body.data.user.userType).toBe('player');
        expect(response.body.data.user.email).toBe('integration.player@example.com');

        // Vérifier que l'utilisateur est créé en base
        const userInDB = await User.findOne({
          where: { email: 'integration.player@example.com' }
        });
        expect(userInDB).toBeDefined();
        expect(userInDB.userType).toBe('player');

        // Vérifier que le profil est créé avec les bonnes associations
        const profileInDB = await PlayerProfile.findOne({
          where: { userId: userInDB.id },
          include: [{ model: User, as: 'user' }]
        });
        expect(profileInDB).toBeDefined();
        expect(profileInDB.position).toBe('midfielder');
        expect(profileInDB.collegeId).toBe(testCollege.id);
        expect(profileInDB.user.email).toBe('integration.player@example.com');
      });

      test('Should validate player data comprehensively', async () => {
        const invalidRegistrations = [
          // Email invalide
          {
            user: {
              email: 'invalid-email',
              password: 'SecurePassword123!',
              firstName: 'Invalid',
              lastName: 'Email',
              userType: 'player'
            },
            profile: {
              dateOfBirth: '2003-01-15',
              position: 'midfielder',
              gender: 'male',
              collegeId: testCollege.id
            }
          },
          // Mot de passe faible
          {
            user: {
              email: 'weak.password@example.com',
              password: '123',
              firstName: 'Weak',
              lastName: 'Password',
              userType: 'player'
            },
            profile: {
              dateOfBirth: '2003-01-15',
              position: 'midfielder',
              gender: 'male',
              collegeId: testCollege.id
            }
          },
          // Position invalide
          {
            user: {
              email: 'invalid.position@example.com',
              password: 'SecurePassword123!',
              firstName: 'Invalid',
              lastName: 'Position',
              userType: 'player'
            },
            profile: {
              dateOfBirth: '2003-01-15',
              position: 'invalid_position',
              gender: 'male',
              collegeId: testCollege.id
            }
          }
        ];

        for (const invalidData of invalidRegistrations) {
          const response = await request(app)
            .post('/api/auth/register')
            .send(invalidData)
            .expect(400);

          TestHelpers.expectErrorResponse(response, 400);
          expect(response.body.message).toBeDefined();
        }
      });

      test('Should prevent duplicate email registration', async () => {
        const userData = {
          user: {
            email: 'duplicate@example.com',
            password: 'SecurePassword123!',
            firstName: 'First',
            lastName: 'User',
            userType: 'player'
          },
          profile: {
            dateOfBirth: '2003-01-15',
            position: 'midfielder',
            gender: 'male',
            collegeId: testCollege.id
          }
        };

        // Premier enregistrement
        await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        // Tentative de duplication
        const duplicateResponse = await request(app)
          .post('/api/auth/register')
          .send({
            ...userData,
            user: { ...userData.user, firstName: 'Duplicate' }
          })
          .expect(400);

        TestHelpers.expectErrorResponse(duplicateResponse, 400);
        expect(duplicateResponse.body.message).toContain('email');
      });
    });

    describe('🏟️ Coach Registration', () => {
      let ncaaCollege;

      beforeEach(async () => {
        ncaaCollege = await TestHelpers.createTestNCAACollege();
      });

      test('Should register NCAA/NAIA coach successfully', async () => {
        const coachData = {
          user: {
            email: 'integration.coach@example.com',
            password: 'SecurePassword123!',
            firstName: 'Integration',
            lastName: 'Coach',
            userType: 'coach'
          },
          profile: {
            position: 'head_coach',
            phoneNumber: '+1234567890',
            collegeId: ncaaCollege.id,
            division: 'ncaa_d1',
            teamSport: 'mens_soccer',
            yearsExperience: 5
          }
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(coachData)
          .expect(201);

        TestHelpers.expectValidJWTResponse(response);
        expect(response.body.data.user.userType).toBe('coach');

        // Vérifier le profil coach en base
        const userInDB = await User.findOne({
          where: { email: 'integration.coach@example.com' }
        });

        const profileInDB = await CoachProfile.findOne({
          where: { userId: userInDB.id },
          include: [{ model: User, as: 'user' }]
        });

        expect(profileInDB).toBeDefined();
        expect(profileInDB.position).toBe('head_coach');
        expect(profileInDB.division).toBe('ncaa_d1');
        expect(profileInDB.yearsExperience).toBe(5);
      });

      test('Should register NJCAA coach with evaluation system', async () => {
        const njcaaCoachData = {
          user: {
            email: 'integration.njcaa.coach@example.com',
            password: 'SecurePassword123!',
            firstName: 'Integration',
            lastName: 'NJCAACoach',
            userType: 'njcaa_coach'
          },
          profile: {
            position: 'assistant_coach',
            phoneNumber: '+0987654321',
            collegeId: testCollege.id,
            division: 'njcaa_d2',
            teamSport: 'womens_soccer'
          }
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(njcaaCoachData)
          .expect(201);

        TestHelpers.expectValidJWTResponse(response);
        expect(response.body.data.user.userType).toBe('njcaa_coach');

        // Vérifier le profil NJCAA coach en base
        const userInDB = await User.findOne({
          where: { email: 'integration.njcaa.coach@example.com' }
        });

        const profileInDB = await NJCAACoachProfile.findOne({
          where: { userId: userInDB.id }
        });

        expect(profileInDB).toBeDefined();
        expect(profileInDB.teamSport).toBe('womens_soccer');
        expect(profileInDB.totalEvaluations).toBe(0); // Commence à zéro
        expect(profileInDB.lastEvaluationDate).toBeNull();
      });

      test('Should validate coach-specific requirements', async () => {
        const invalidCoachData = {
          user: {
            email: 'invalid.coach@example.com',
            password: 'SecurePassword123!',
            firstName: 'Invalid',
            lastName: 'Coach',
            userType: 'coach'
          },
          profile: {
            position: 'invalid_position', // Position invalide
            phoneNumber: '123', // Téléphone trop court
            collegeId: 99999, // College inexistant
            division: 'invalid_division',
            teamSport: 'invalid_sport'
          }
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(invalidCoachData)
          .expect(400);

        TestHelpers.expectErrorResponse(response, 400);
      });
    });
  });

  describe('🔐 User Login Workflows', () => {
    let registeredPlayer;
    let registeredCoach;
    let registeredNJCAACoach;

    beforeEach(async () => {
      // Créer des utilisateurs de test pour les connexions
      const playerData = await TestHelpers.createTestPlayer({
        college: testCollege,
        user: {
          email: 'login.player@example.com',
          password: 'LoginPassword123!'
        }
      });
      registeredPlayer = playerData.user;

      const coachData = await TestHelpers.createTestCoach({
        user: {
          email: 'login.coach@example.com',
          password: 'LoginPassword123!'
        }
      });
      registeredCoach = coachData.user;

      const njcaaCoachData = await TestHelpers.createTestNJCAACoach({
        college: testCollege,
        user: {
          email: 'login.njcaa.coach@example.com',
          password: 'LoginPassword123!'
        }
      });
      registeredNJCAACoach = njcaaCoachData.user;
    });

    test('Should login player with valid credentials', async () => {
      const loginData = {
        email: 'login.player@example.com',
        password: 'LoginPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      TestHelpers.expectValidJWTResponse(response);
      expect(response.body.data.user.userType).toBe('player');
      expect(response.body.data.user.email).toBe('login.player@example.com');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    test('Should login coach with valid credentials', async () => {
      const loginData = {
        email: 'login.coach@example.com',
        password: 'LoginPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      TestHelpers.expectValidJWTResponse(response);
      expect(response.body.data.user.userType).toBe('coach');
    });

    test('Should login NJCAA coach with valid credentials', async () => {
      const loginData = {
        email: 'login.njcaa.coach@example.com',
        password: 'LoginPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      TestHelpers.expectValidJWTResponse(response);
      expect(response.body.data.user.userType).toBe('njcaa_coach');
    });

    test('Should reject invalid password', async () => {
      const loginData = {
        email: 'login.player@example.com',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
      expect(response.body.message).toContain('Invalid');
    });

    test('Should reject non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'AnyPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
    });

    test('Should reject inactive user login', async () => {
      // Désactiver l'utilisateur
      registeredPlayer.isActive = false;
      await registeredPlayer.save();

      const loginData = {
        email: 'login.player@example.com',
        password: 'LoginPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
      expect(response.body.message).toContain('inactive');
    });

    test('Should handle case-insensitive email login', async () => {
      const loginData = {
        email: 'LOGIN.PLAYER@EXAMPLE.COM', // Email en majuscules
        password: 'LoginPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      TestHelpers.expectValidJWTResponse(response);
      expect(response.body.data.user.email).toBe('login.player@example.com'); // Stocké en minuscules
    });
  });

  describe('🔄 Token Refresh Workflows', () => {
    let playerTokens;
    let coachTokens;

    beforeEach(async () => {
      // Créer des utilisateurs et récupérer leurs tokens
      const playerData = await TestHelpers.createTestPlayer();
      const coachData = await TestHelpers.createTestCoach();

      // Simuler une connexion pour obtenir des tokens
      const playerLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: playerData.user.email,
          password: 'TestPassword123!' // Mot de passe par défaut des helpers
        });

      const coachLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: coachData.user.email,
          password: 'TestPassword123!'
        });

      playerTokens = playerLogin.body.data.tokens;
      coachTokens = coachLogin.body.data.tokens;
    });

    test('Should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: playerTokens.refreshToken
        })
        .expect(200);

      TestHelpers.expectValidJWTResponse(response);
      expect(response.body.data.tokens.accessToken).not.toBe(playerTokens.accessToken);
      expect(response.body.data.tokens.refreshToken).not.toBe(playerTokens.refreshToken);
    });

    test('Should reject refresh with access token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: playerTokens.accessToken // Utiliser access token au lieu de refresh
        })
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
    });

    test('Should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid.refresh.token'
        })
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
    });

    test('Should maintain user type in refreshed tokens', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: coachTokens.refreshToken
        })
        .expect(200);

      expect(response.body.data.user.userType).toBe('coach');
    });
  });

  describe('🔒 Password Reset Workflows', () => {
    let testUser;

    beforeEach(async () => {
      const userData = await TestHelpers.createTestPlayer();
      testUser = userData.user;
    });

    test('Should initiate password reset successfully', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: testUser.email
        })
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.message).toContain('reset');

      // Vérifier que le token de reset est généré en base
      await testUser.reload();
      expect(testUser.resetPasswordToken).toBeDefined();
      expect(testUser.resetPasswordExpires).toBeInstanceOf(Date);
    });

    test('Should handle non-existent email gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        })
        .expect(200); // Toujours 200 pour éviter l'énumération d'emails

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.message).toContain('reset');
    });

    test('Should reset password with valid token', async () => {
      // Générer un token de reset
      const resetToken = testUser.generatePasswordResetToken();
      await testUser.save();

      const newPassword = 'NewSecurePassword123!';

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: newPassword
        })
        .expect(200);

      TestHelpers.expectSuccessResponse(response);

      // Vérifier que le nouveau mot de passe fonctionne
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: newPassword
        })
        .expect(200);

      TestHelpers.expectValidJWTResponse(loginResponse);
    });

    test('Should reject expired reset token', async () => {
      // Générer un token expiré
      const resetToken = testUser.generatePasswordResetToken();
      testUser.resetPasswordExpires = new Date(Date.now() - 3600000); // Expiré il y a 1 heure
      await testUser.save();

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewPassword123!'
        })
        .expect(400);

      TestHelpers.expectErrorResponse(response, 400);
      expect(response.body.message).toContain('expired');
    });

    test('Should reject invalid reset token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-reset-token',
          password: 'NewPassword123!'
        })
        .expect(400);

      TestHelpers.expectErrorResponse(response, 400);
    });
  });

  describe('👤 Profile Retrieval Workflows', () => {
    let playerUser;
    let coachUser;
    let njcaaCoachUser;
    let playerToken;
    let coachToken;
    let njcaaCoachToken;

    beforeEach(async () => {
      // Créer des utilisateurs avec profils complets
      const playerData = await TestHelpers.createTestPlayer();
      const coachData = await TestHelpers.createTestCoach();
      const njcaaCoachData = await TestHelpers.createTestNJCAACoach();

      playerUser = playerData.user;
      coachUser = coachData.user;
      njcaaCoachUser = njcaaCoachData.user;

      playerToken = playerData.getAuthToken();
      coachToken = coachData.getAuthToken();
      njcaaCoachToken = njcaaCoachData.getAuthToken();
    });

    test('Should get current player profile with associations', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.user.userType).toBe('player');
      expect(response.body.data.profile).toBeDefined();
      expect(response.body.data.profile.position).toBeDefined();
      expect(response.body.data.profile.college).toBeDefined();
    });

    test('Should get current coach profile with college info', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.user.userType).toBe('coach');
      expect(response.body.data.profile).toBeDefined();
      expect(response.body.data.profile.division).toBeDefined();
    });

    test('Should get current NJCAA coach profile with evaluation metrics', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.user.userType).toBe('njcaa_coach');
      expect(response.body.data.profile).toBeDefined();
      expect(response.body.data.profile.totalEvaluations).toBeDefined();
      expect(response.body.data.profile.teamSport).toBeDefined();
    });

    test('Should reject unauthorized profile access', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
    });

    test('Should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
    });
  });

  describe('🚪 Logout Workflows', () => {
    let userToken;

    beforeEach(async () => {
      const userData = await TestHelpers.createTestPlayer();
      userToken = userData.getAuthToken();
    });

    test('Should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.message).toContain('logout');
    });

    test('Should handle logout without token gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
    });
  });

  describe('🔍 Input Validation and Security', () => {
    test('Should validate required fields on registration', async () => {
      const incompleteData = {
        user: {
          // email manquant
          password: 'SecurePassword123!',
          firstName: 'Incomplete',
          userType: 'player'
        }
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData)
        .expect(400);

      TestHelpers.expectErrorResponse(response, 400);
    });

    test('Should sanitize input data', async () => {
      const maliciousData = {
        user: {
          email: 'malicious@example.com',
          password: 'SecurePassword123!',
          firstName: '<script>alert("xss")</script>',
          lastName: '"; DROP TABLE users; --',
          userType: 'player'
        },
        profile: {
          dateOfBirth: '2003-01-15',
          position: 'midfielder',
          gender: 'male',
          collegeId: testCollege.id
        }
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousData)
        .expect(201);

      // Vérifier que les données malicieuses sont sanitizées
      expect(response.body.data.user.firstName).not.toContain('<script>');
      expect(response.body.data.user.lastName).not.toContain('DROP TABLE');
    });

    test('Should enforce rate limiting on login attempts', async () => {
      const loginData = {
        email: 'ratelimit@example.com',
        password: 'WrongPassword123!'
      };

      // Faire plusieurs tentatives rapidement
      const attempts = Array(10).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(attempts);

      // Certaines requêtes devraient être limitées
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('⚡ Performance and Concurrency', () => {
    test('Should handle concurrent registrations', async () => {
      const registrations = Array(5).fill().map((_, i) => ({
        user: {
          email: `concurrent${i}@example.com`,
          password: 'SecurePassword123!',
          firstName: `Concurrent${i}`,
          lastName: 'User',
          userType: 'player'
        },
        profile: {
          dateOfBirth: '2003-01-15',
          position: 'midfielder',
          gender: 'male',
          collegeId: testCollege.id
        }
      }));

      const promises = registrations.map(data =>
        request(app).post('/api/auth/register').send(data)
      );

      const responses = await Promise.all(promises);

      // Tous les enregistrements devraient réussir
      expect(responses.every(r => r.status === 201)).toBe(true);

      // Vérifier qu'ils sont tous en base
      const usersInDB = await User.findAll({
        where: {
          email: {
            [require('sequelize').Op.like]: 'concurrent%@example.com'
          }
        }
      });

      expect(usersInDB.length).toBe(5);
    });

    test('Should maintain response time under load', async () => {
      const userData = await TestHelpers.createTestPlayer();
      const token = userData.getAuthToken();

      const startTime = Date.now();

      // Faire plusieurs requêtes simultanées
      const requests = Array(20).fill().map(() =>
        request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`)
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / requests.length;

      // Temps de réponse moyen devrait être raisonnable
      expect(avgTimePerRequest).toBeLessThan(100); // Moins de 100ms par requête
      expect(responses.every(r => r.status === 200)).toBe(true);
    });
  });
});