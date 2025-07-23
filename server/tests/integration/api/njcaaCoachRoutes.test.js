// portall/server/tests/integration/api/njcaaCoachRoutes.test.js

process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../../server');
const TestHelpers = require('../../utils/testHelpers');
const { User, NJCAACoachProfile, PlayerProfile } = require('../../../models');

/**
 * 🏟️ Tests d'intégration des routes NJCAA Coach - Innovation Phase 5B
 * 
 * Ces tests valident le système d'évaluation unique des coachs NJCAA qui leur
 * permet d'évaluer et de gérer leurs propres joueurs. Cette fonctionnalité
 * différencie fondamentalement les coachs NJCAA des coachs NCAA/NAIA.
 * 
 * 🎯 Concept pédagogique : "Role-Based API Testing"
 * Chaque type d'utilisateur a des permissions et fonctionnalités différentes.
 * Ces tests vérifient que l'API respecte ces boundaries métier et que chaque
 * rôle peut seulement accéder aux fonctionnalités qui lui sont destinées.
 * 
 * 💡 Système d'évaluation testé :
 * - Dashboard avec liste des joueurs de leur college
 * - Filtrage par genre selon l'équipe (hommes/femmes)
 * - Système de comptage des évaluations
 * - Restrictions d'accès par college et permissions
 * 
 * 🔧 Architecture de sécurité :
 * - Authentification JWT obligatoire
 * - Autorisation basée sur le type d'utilisateur
 * - Isolation des données par college
 * - Validation des permissions d'évaluation
 */

describe('🏟️ NJCAA Coach Routes Integration - Phase 5B Player Evaluation System', () => {
  let testCollege;
  let otherCollege;
  let njcaaCoach;
  let njcaaCoachToken;
  let malePlayer;
  let femalePlayer;

  beforeAll(async () => {
    // Créer les colleges de test
    testCollege = await TestHelpers.createTestNJCAACollege({
      name: 'Test NJCAA Soccer College',
      state: 'TX',
      division: 'division_1'
    });

    otherCollege = await TestHelpers.createTestNJCAACollege({
      name: 'Other NJCAA College',
      state: 'CA',
      division: 'division_2'
    });
  });

  beforeEach(async () => {
    await TestHelpers.cleanupTestData();

    // Créer un coach NJCAA pour les tests
    const coachData = await TestHelpers.createTestNJCAACoach({
      college: testCollege,
      user: {
        email: 'integration.njcaa.coach@example.com',
        firstName: 'Integration',
        lastName: 'Coach'
      },
      profile: {
        position: 'head_coach',
        teamSport: 'mens_soccer',
        division: 'njcaa_d1'
      }
    });

    njcaaCoach = coachData.user;
    njcaaCoachToken = coachData.getAuthToken();

    // Créer des joueurs de test dans le même college
    const malePlayerData = await TestHelpers.createTestPlayer({
      college: testCollege,
      profile: {
        gender: 'male',
        position: 'midfielder',
        currentYear: 'sophomore',
        isProfileVisible: true
      }
    });
    malePlayer = malePlayerData.profile;

    const femalePlayerData = await TestHelpers.createTestPlayer({
      college: testCollege,
      profile: {
        gender: 'female',
        position: 'forward',
        currentYear: 'freshman',
        isProfileVisible: true
      }
    });
    femalePlayer = femalePlayerData.profile;
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('🏥 Health Check and Service Status', () => {
    test('Should return NJCAA coach service health', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/health')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('NJCAA Coach service');
      expect(response.body.data).toHaveProperty('playerEvaluationSystem');
      expect(response.body.data.playerEvaluationSystem).toBe('operational');
    });

    test('Should include evaluation system metrics in health check', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/health')
        .expect(200);

      expect(response.body.data).toHaveProperty('features');
      expect(response.body.data.features).toContain('player-evaluation');
      expect(response.body.data.features).toContain('team-management');
      expect(response.body.data.features).toContain('gender-filtering');
    });
  });

  describe('📊 Dashboard and Profile Management', () => {
    test('Should get coach dashboard with player statistics', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/dashboard')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('coach');
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data).toHaveProperty('recentActivity');

      // Vérifier les statistiques
      expect(response.body.data.stats).toHaveProperty('totalPlayers');
      expect(response.body.data.stats).toHaveProperty('totalEvaluations');
      expect(response.body.data.stats).toHaveProperty('lastEvaluationDate');
    });

    test('Should get coach profile with complete information', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/profile')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.user.userType).toBe('njcaa_coach');
      expect(response.body.data.profile.position).toBe('head_coach');
      expect(response.body.data.profile.teamSport).toBe('mens_soccer');
      expect(response.body.data.profile.college).toBeDefined();
      expect(response.body.data.profile.college.name).toBe('Test NJCAA Soccer College');
    });

    test('Should update coach profile successfully', async () => {
      const updateData = {
        position: 'assistant_coach',
        phoneNumber: '+1987654321',
        teamSport: 'womens_soccer'
      };

      const response = await request(app)
        .put('/api/njcaa-coaches/profile')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .send(updateData)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.position).toBe('assistant_coach');
      expect(response.body.data.teamSport).toBe('womens_soccer');

      // Vérifier en base de données
      const profileInDB = await NJCAACoachProfile.findOne({
        where: { userId: njcaaCoach.id }
      });
      expect(profileInDB.position).toBe('assistant_coach');
      expect(profileInDB.teamSport).toBe('womens_soccer');
    });

    test('Should reject unauthorized dashboard access', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/dashboard')
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
    });

    test('Should reject access from non-NJCAA coach users', async () => {
      // Créer un joueur et tenter d'accéder au dashboard coach
      const playerData = await TestHelpers.createTestPlayer();
      const playerToken = playerData.getAuthToken();

      const response = await request(app)
        .get('/api/njcaa-coaches/dashboard')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403);

      TestHelpers.expectErrorResponse(response, 403);
      expect(response.body.message).toContain('NJCAA coach');
    });
  });

  describe('👥 Player Management and Filtering', () => {
    test('Should get players filtered by team gender (mens soccer)', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/my-players')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.players).toHaveLength(1); // Seulement le joueur masculin
      expect(response.body.data.players[0].gender).toBe('male');
      expect(response.body.data.players[0].collegeId).toBe(testCollege.id);
      expect(response.body.data.filterApplied).toBe('mens_soccer');
    });

    test('Should get female players when coach switches to womens soccer', async () => {
      // Changer l'équipe du coach vers womens_soccer
      const coachProfile = await NJCAACoachProfile.findOne({
        where: { userId: njcaaCoach.id }
      });
      coachProfile.teamSport = 'womens_soccer';
      await coachProfile.save();

      const response = await request(app)
        .get('/api/njcaa-coaches/my-players')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.players).toHaveLength(1); // Seulement la joueuse
      expect(response.body.data.players[0].gender).toBe('female');
      expect(response.body.data.filterApplied).toBe('womens_soccer');
    });

    test('Should only see players from same college', async () => {
      // Créer un joueur dans un autre college
      await TestHelpers.createTestPlayer({
        college: otherCollege,
        profile: {
          gender: 'male',
          position: 'defender',
          isProfileVisible: true
        }
      });

      const response = await request(app)
        .get('/api/njcaa-coaches/my-players')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      // Devrait voir seulement le joueur de son college
      expect(response.body.data.players).toHaveLength(1);
      expect(response.body.data.players[0].collegeId).toBe(testCollege.id);
      expect(response.body.data.collegeRestriction).toBe(true);
    });

    test('Should not see hidden player profiles', async () => {
      // Cacher le profil du joueur masculin
      malePlayer.isProfileVisible = false;
      await malePlayer.save();

      const response = await request(app)
        .get('/api/njcaa-coaches/my-players')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      // Ne devrait voir aucun joueur visible
      expect(response.body.data.players).toHaveLength(0);
    });

    test('Should include player user information', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/my-players')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      const player = response.body.data.players[0];
      expect(player.user).toBeDefined();
      expect(player.user.firstName).toBeDefined();
      expect(player.user.lastName).toBeDefined();
      expect(player.user.email).toBeDefined();
      expect(player.user).not.toHaveProperty('password'); // Pas de données sensibles
    });

    test('Should order players by creation date (newest first)', async () => {
      // Créer un second joueur masculin plus récent
      const newerPlayerData = await TestHelpers.createTestPlayer({
        college: testCollege,
        profile: {
          gender: 'male',
          position: 'goalkeeper',
          currentYear: 'freshman',
          isProfileVisible: true
        }
      });

      const response = await request(app)
        .get('/api/njcaa-coaches/my-players')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      expect(response.body.data.players).toHaveLength(2);
      // Le plus récent devrait être en premier
      expect(response.body.data.players[0].id).toBe(newerPlayerData.profile.id);
      expect(response.body.data.players[1].id).toBe(malePlayer.id);
    });
  });

  describe('⭐ Player Evaluation System', () => {
    test('Should evaluate a player successfully', async () => {
      const evaluationData = {
        playerId: malePlayer.id,
        rating: 4,
        notes: 'Excellent midfielder with great vision and passing ability.',
        skills: {
          technical: 4,
          tactical: 4,
          physical: 3,
          mental: 5
        }
      };

      const response = await request(app)
        .post('/api/njcaa-coaches/evaluate-player')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .send(evaluationData)
        .expect(201);

      TestHelpers.expectSuccessResponse(response, 201);
      expect(response.body.data.evaluation).toBeDefined();
      expect(response.body.data.evaluation.rating).toBe(4);
      expect(response.body.data.evaluation.notes).toContain('Excellent midfielder');

      // Vérifier que les compteurs sont mis à jour
      const coachProfile = await NJCAACoachProfile.findByPk(response.body.data.coachProfile.id);
      expect(coachProfile.totalEvaluations).toBe(1);
      expect(coachProfile.lastEvaluationDate).toBeInstanceOf(Date);
    });

    test('Should prevent evaluating players from other colleges', async () => {
      // Créer un joueur dans un autre college
      const otherPlayerData = await TestHelpers.createTestPlayer({
        college: otherCollege,
        profile: {
          gender: 'male',
          position: 'forward',
          isProfileVisible: true
        }
      });

      const evaluationData = {
        playerId: otherPlayerData.profile.id,
        rating: 3,
        notes: 'Should not be allowed'
      };

      const response = await request(app)
        .post('/api/njcaa-coaches/evaluate-player')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .send(evaluationData)
        .expect(403);

      TestHelpers.expectErrorResponse(response, 403);
      expect(response.body.message).toContain('college');
    });

    test('Should prevent evaluating players of wrong gender', async () => {
      // Coach d'équipe masculine tentant d'évaluer une joueuse
      const evaluationData = {
        playerId: femalePlayer.id,
        rating: 4,
        notes: 'Should not be allowed for mens coach'
      };

      const response = await request(app)
        .post('/api/njcaa-coaches/evaluate-player')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .send(evaluationData)
        .expect(403);

      TestHelpers.expectErrorResponse(response, 403);
      expect(response.body.message).toContain('gender');
    });

    test('Should validate evaluation data', async () => {
      const invalidEvaluations = [
        // Rating trop élevé
        {
          playerId: malePlayer.id,
          rating: 6, // Max est 5
          notes: 'Invalid rating'
        },
        // Rating trop bas
        {
          playerId: malePlayer.id,
          rating: 0, // Min est 1
          notes: 'Invalid rating'
        },
        // PlayerId manquant
        {
          rating: 4,
          notes: 'Missing player ID'
        }
      ];

      for (const invalidData of invalidEvaluations) {
        const response = await request(app)
          .post('/api/njcaa-coaches/evaluate-player')
          .set('Authorization', `Bearer ${njcaaCoachToken}`)
          .send(invalidData)
          .expect(400);

        TestHelpers.expectErrorResponse(response, 400);
      }
    });

    test('Should get evaluation history for coach', async () => {
      // Créer quelques évaluations
      const evaluation1Data = {
        playerId: malePlayer.id,
        rating: 4,
        notes: 'First evaluation'
      };

      await request(app)
        .post('/api/njcaa-coaches/evaluate-player')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .send(evaluation1Data);

      // Créer un second joueur et l'évaluer
      const secondPlayerData = await TestHelpers.createTestPlayer({
        college: testCollege,
        profile: {
          gender: 'male',
          position: 'defender',
          isProfileVisible: true
        }
      });

      const evaluation2Data = {
        playerId: secondPlayerData.profile.id,
        rating: 3,
        notes: 'Second evaluation'
      };

      await request(app)
        .post('/api/njcaa-coaches/evaluate-player')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .send(evaluation2Data);

      // Récupérer l'historique
      const response = await request(app)
        .get('/api/njcaa-coaches/my-evaluations')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.evaluations).toHaveLength(2);
      expect(response.body.data.totalEvaluations).toBe(2);
      expect(response.body.data.evaluations[0].notes).toBe('Second evaluation'); // Plus récent en premier
    });

    test('Should update evaluation count and timestamp correctly', async () => {
      const coachProfileBefore = await NJCAACoachProfile.findOne({
        where: { userId: njcaaCoach.id }
      });
      const initialCount = coachProfileBefore.totalEvaluations;
      const initialDate = coachProfileBefore.lastEvaluationDate;

      // Faire une évaluation
      await request(app)
        .post('/api/njcaa-coaches/evaluate-player')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .send({
          playerId: malePlayer.id,
          rating: 4,
          notes: 'Count test evaluation'
        });

      // Vérifier les compteurs
      const coachProfileAfter = await NJCAACoachProfile.findOne({
        where: { userId: njcaaCoach.id }
      });

      expect(coachProfileAfter.totalEvaluations).toBe(initialCount + 1);
      expect(coachProfileAfter.lastEvaluationDate).not.toBe(initialDate);
      expect(coachProfileAfter.lastEvaluationDate).toBeInstanceOf(Date);
    });
  });

  describe('📊 Analytics and Statistics', () => {
    beforeEach(async () => {
      // Créer plusieurs évaluations pour les tests d'analytics
      const evaluations = [
        { playerId: malePlayer.id, rating: 5, notes: 'Excellent performance' },
        { playerId: malePlayer.id, rating: 4, notes: 'Good improvement' },
        { playerId: malePlayer.id, rating: 3, notes: 'Average showing' }
      ];

      for (const evaluation of evaluations) {
        await request(app)
          .post('/api/njcaa-coaches/evaluate-player')
          .set('Authorization', `Bearer ${njcaaCoachToken}`)
          .send(evaluation);
      }
    });

    test('Should get evaluation statistics', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/stats')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.totalEvaluations).toBe(3);
      expect(response.body.data.averageRating).toBeCloseTo(4, 1); // (5+4+3)/3 = 4
      expect(response.body.data.evaluationFrequency).toBeDefined();
      expect(response.body.data.lastActivity).toBeInstanceOf(Date);
    });

    test('Should get team performance overview', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/team-overview')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.teamStats).toBeDefined();
      expect(response.body.data.playerCount).toBe(1); // Un joueur masculin visible
      expect(response.body.data.averageTeamRating).toBeCloseTo(4, 1);
      expect(response.body.data.playersByPosition).toHaveProperty('midfielder', 1);
    });

    test('Should filter analytics by date range', async () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const response = await request(app)
        .get('/api/njcaa-coaches/stats')
        .query({
          startDate: oneWeekAgo.toISOString(),
          endDate: tomorrow.toISOString()
        })
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.totalEvaluations).toBe(3); // Toutes dans la période
      expect(response.body.data.dateRange).toBeDefined();
    });
  });

  describe('🔒 Security and Authorization', () => {
    test('Should enforce NJCAA coach role requirement', async () => {
      // Créer un coach NCAA (non NJCAA) et tenter d'accéder
      const ncaaCoachData = await TestHelpers.createTestCoach();
      const ncaaCoachToken = ncaaCoachData.getAuthToken();

      const response = await request(app)
        .get('/api/njcaa-coaches/dashboard')
        .set('Authorization', `Bearer ${ncaaCoachToken}`)
        .expect(403);

      TestHelpers.expectErrorResponse(response, 403);
      expect(response.body.message).toContain('NJCAA coach');
    });

    test('Should prevent unauthorized player evaluation', async () => {
      // Tenter d'évaluer sans authentification
      const response = await request(app)
        .post('/api/njcaa-coaches/evaluate-player')
        .send({
          playerId: malePlayer.id,
          rating: 4,
          notes: 'Unauthorized evaluation'
        })
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
    });

    test('Should validate token authenticity', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/dashboard')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
    });

    test('Should prevent cross-college data access', async () => {
      // Créer un coach dans un autre college
      const otherCoachData = await TestHelpers.createTestNJCAACoach({
        college: otherCollege
      });
      const otherCoachToken = otherCoachData.getAuthToken();

      const response = await request(app)
        .get('/api/njcaa-coaches/my-players')
        .set('Authorization', `Bearer ${otherCoachToken}`)
        .expect(200);

      // Devrait voir 0 joueurs (aucun dans son college)
      expect(response.body.data.players).toHaveLength(0);
    });
  });

  describe('⚡ Performance and Scalability', () => {
    test('Should handle large player lists efficiently', async () => {
      // Créer beaucoup de joueurs masculins
      const playerPromises = Array(50).fill().map((_, i) =>
        TestHelpers.createTestPlayer({
          college: testCollege,
          profile: {
            gender: 'male',
            position: 'midfielder',
            currentYear: 'freshman',
            isProfileVisible: true
          }
        })
      );

      await Promise.all(playerPromises);

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/njcaa-coaches/my-players')
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(1000); // Moins d'une seconde
      expect(response.body.data.players.length).toBeGreaterThan(20);
    });

    test('Should support pagination for large datasets', async () => {
      // Créer plusieurs joueurs pour tester la pagination
      await Promise.all(Array(15).fill().map(() =>
        TestHelpers.createTestPlayer({
          college: testCollege,
          profile: {
            gender: 'male',
            position: 'midfielder',
            isProfileVisible: true
          }
        })
      ));

      const response = await request(app)
        .get('/api/njcaa-coaches/my-players')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${njcaaCoachToken}`)
        .expect(200);

      expect(response.body.data.players.length).toBeLessThanOrEqual(10);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalItems).toBeGreaterThan(10);
    });

    test('Should handle concurrent evaluations', async () => {
      // Créer plusieurs joueurs
      const players = await Promise.all(Array(5).fill().map(() =>
        TestHelpers.createTestPlayer({
          college: testCollege,
          profile: {
            gender: 'male',
            position: 'midfielder',
            isProfileVisible: true
          }
        })
      ));

      // Évaluer tous simultanément
      const evaluationPromises = players.map((playerData, i) =>
        request(app)
          .post('/api/njcaa-coaches/evaluate-player')
          .set('Authorization', `Bearer ${njcaaCoachToken}`)
          .send({
            playerId: playerData.profile.id,
            rating: 3 + (i % 3), // Ratings variés
            notes: `Concurrent evaluation ${i}`
          })
      );

      const responses = await Promise.all(evaluationPromises);

      // Toutes les évaluations devraient réussir
      expect(responses.every(r => r.status === 201)).toBe(true);

      // Vérifier le count final
      const finalProfile = await NJCAACoachProfile.findOne({
        where: { userId: njcaaCoach.id }
      });
      expect(finalProfile.totalEvaluations).toBe(5);
    });
  });
});