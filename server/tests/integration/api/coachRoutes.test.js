// portall/server/tests/integration/api/coachRoutes.test.js

process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../../server');
const TestHelpers = require('../../utils/testHelpers');
const { User, CoachProfile, NCAACollege, PlayerProfile } = require('../../../models');

/**
 * 🏟️ Tests d'intégration des routes Coaches NCAA/NAIA - Système de recrutement
 * 
 * Ces tests valident l'écosystème complet des coachs NCAA/NAIA qui représentent
 * les "acheteurs" dans votre marketplace. Ils cherchent, évaluent et recrutent
 * des talents NJCAA pour leurs programmes universitaires.
 * 
 * 🎯 Concept pédagogique : "Buyer Journey Testing"
 * Dans votre marketplace, les coachs NCAA/NAIA sont les acheteurs qui investissent
 * (via Stripe) pour accéder aux talents NJCAA. Ces tests valident chaque étape
 * de leur parcours d'achat : découverte, évaluation, engagement, suivi.
 * 
 * 💡 Écosystème coach testé :
 * - Dashboard avec métriques de recrutement
 * - Système de recherche et filtres avancés
 * - Gestion des favoris et prospects
 * - Analytics de performance de recrutement
 * - Intégration avec le système d'abonnement Stripe
 * 
 * 🔧 Architecture business critique :
 * - Coaches payent pour accéder aux fonctionnalités premium
 * - Système de favoris pour gérer leur pipeline de recrutement
 * - Analytics pour optimiser leur stratégie de recrutement
 * - Workflow de suivi des prospects
 */

describe('🏟️ Coach NCAA/NAIA Routes Integration - Recruitment Ecosystem', () => {
  let testNCAACollege;
  let testNJCAACollege;
  let testCoach;
  let coachToken;
  let testPlayers;
  let testAdmin;
  let adminToken;

  beforeAll(async () => {
    // Créer les colleges de test
    testNCAACollege = await TestHelpers.createTestNCAACollege({
      name: 'University of Excellence',
      state: 'CA',
      division: 'ncaa_d1',
      conference: 'Pacific Conference'
    });

    testNJCAACollege = await TestHelpers.createTestNJCAACollege({
      name: 'Community College Athletics',
      state: 'NV',
      division: 'division_1'
    });
  });

  beforeEach(async () => {
    await TestHelpers.cleanupTestData();

    // Créer un coach NCAA pour les tests
    const coachData = await TestHelpers.createTestCoach({
      college: testNCAACollege,
      user: {
        email: 'coach.recruiter@university.edu',
        firstName: 'Michael',
        lastName: 'Recruiter'
      },
      profile: {
        position: 'head_coach',
        teamSport: 'mens_soccer',
        yearsExperience: 8
      }
    });
    testCoach = coachData.user;
    coachToken = coachData.getAuthToken();

    // Créer des joueurs NJCAA pour les tests de recherche
    testPlayers = await Promise.all([
      TestHelpers.createTestPlayer({
        college: testNJCAACollege,
        user: { firstName: 'Star', lastName: 'Midfielder' },
        profile: {
          position: 'midfielder',
          currentYear: 'sophomore',
          gpa: 3.8,
          height: 175,
          isProfileVisible: true
        }
      }),
      TestHelpers.createTestPlayer({
        college: testNJCAACollege,
        user: { firstName: 'Fast', lastName: 'Forward' },
        profile: {
          position: 'forward',
          currentYear: 'freshman',
          gpa: 3.2,
          height: 180,
          isProfileVisible: true
        }
      }),
      TestHelpers.createTestPlayer({
        college: testNJCAACollege,
        user: { firstName: 'Solid', lastName: 'Defender' },
        profile: {
          position: 'defender',
          currentYear: 'sophomore',
          gpa: 3.5,
          height: 178,
          isProfileVisible: false // Profil caché pour tester la visibilité
        }
      })
    ]);

    // Admin pour certains tests
    const adminData = await TestHelpers.createTestAdmin({
      email: 'admin.system@example.com'
    });
    testAdmin = adminData.user;
    adminToken = adminData.getAuthToken();
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('🏥 Health Check and Service Discovery', () => {
    test('Should return comprehensive coach service status', async () => {
      const response = await request(app)
        .get('/api/coaches/health')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('Coach routes');
      expect(response.body.availableEndpoints).toBeDefined();
      expect(response.body.availableEndpoints).toHaveProperty('dashboard');
      expect(response.body.availableEndpoints).toHaveProperty('search');
      expect(response.body.availableEndpoints).toHaveProperty('favorites');
    });
  });

  describe('📊 Coach Dashboard and Recruitment Metrics', () => {
    test('Should get comprehensive coach dashboard with recruitment analytics', async () => {
      const response = await request(app)
        .get('/api/coaches/dashboard')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('coach');
      expect(response.body.data).toHaveProperty('profile');
      expect(response.body.data).toHaveProperty('recruitmentStats');
      expect(response.body.data).toHaveProperty('recentActivity');

      // Vérifier les données du coach
      expect(response.body.data.coach.firstName).toBe('Michael');
      expect(response.body.data.profile.position).toBe('head_coach');
      expect(response.body.data.profile.college).toBeDefined();

      // Vérifier les statistiques de recrutement
      expect(response.body.data.recruitmentStats).toHaveProperty('totalSearches');
      expect(response.body.data.recruitmentStats).toHaveProperty('savedPlayers');
      expect(response.body.data.recruitmentStats).toHaveProperty('activeProspects');
    });

    test('Should get detailed coach recruitment analytics', async () => {
      const response = await request(app)
        .get('/api/coaches/analytics')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('searchHistory');
      expect(response.body.data).toHaveProperty('playerInteractions');
      expect(response.body.data).toHaveProperty('recruitmentTrends');
      expect(response.body.data).toHaveProperty('performanceMetrics');
    });

    test('Should reject unauthorized dashboard access', async () => {
      const response = await request(app)
        .get('/api/coaches/dashboard')
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
    });

    test('Should reject non-coach dashboard access', async () => {
      const playerData = await TestHelpers.createTestPlayer();
      const playerToken = playerData.getAuthToken();

      const response = await request(app)
        .get('/api/coaches/dashboard')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403);

      TestHelpers.expectErrorResponse(response, 403);
    });
  });

  describe('👤 Coach Profile Management', () => {
    test('Should update coach profile with recruitment-specific data', async () => {
      const profileUpdates = {
        position: 'assistant_coach',
        yearsExperience: 10,
        teamSport: 'womens_soccer',
        bio: 'Experienced recruiter specializing in developing young talent from community college programs.',
        recruitmentFocus: ['midfielders', 'forwards'],
        preferredRegions: ['West Coast', 'Southwest'],
        contactPreferences: {
          email: true,
          phone: false,
          preferredTime: 'evenings'
        }
      };

      const response = await request(app)
        .put('/api/coaches/profile')
        .set('Authorization', `Bearer ${coachToken}`)
        .send(profileUpdates)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.position).toBe('assistant_coach');
      expect(response.body.data.yearsExperience).toBe(10);
      expect(response.body.data.bio).toContain('community college');

      // Vérifier persistence en base
      const profileInDB = await CoachProfile.findOne({
        where: { userId: testCoach.id }
      });
      expect(profileInDB.position).toBe('assistant_coach');
      expect(profileInDB.teamSport).toBe('womens_soccer');
    });

    test('Should validate coach-specific profile requirements', async () => {
      const invalidUpdates = [
        // Années d'expérience négatives
        {
          yearsExperience: -1,
          position: 'head_coach'
        },
        // Position invalide
        {
          position: 'invalid_coach_position',
          yearsExperience: 5
        },
        // Sport d'équipe invalide
        {
          teamSport: 'invalid_sport',
          position: 'head_coach'
        }
      ];

      for (const invalidData of invalidUpdates) {
        const response = await request(app)
          .put('/api/coaches/profile')
          .set('Authorization', `Bearer ${coachToken}`)
          .send(invalidData)
          .expect(400);

        TestHelpers.expectErrorResponse(response, 400);
      }
    });

    test('Should allow public coach profile viewing', async () => {
      const response = await request(app)
        .get(`/api/coaches/${testCoach.id}/profile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.user.firstName).toBe('Michael');
      expect(response.body.data.profile.position).toBe('head_coach');
      expect(response.body.data.college).toBeDefined();
    });
  });

  describe('🔍 Player Search and Discovery System', () => {
    test('Should search players with comprehensive filters', async () => {
      const searchResponse = await request(app)
        .get('/api/coaches/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({
          position: 'midfielder',
          minGPA: 3.5,
          currentYear: 'sophomore',
          college: testNJCAACollege.id
        })
        .expect(200);

      TestHelpers.expectSuccessResponse(searchResponse);
      expect(searchResponse.body.data.players).toHaveLength(1);
      
      const foundPlayer = searchResponse.body.data.players[0];
      expect(foundPlayer.position).toBe('midfielder');
      expect(foundPlayer.gpa).toBeGreaterThanOrEqual(3.5);
      expect(foundPlayer.currentYear).toBe('sophomore');
    });

    test('Should only return visible player profiles in search', async () => {
      const searchResponse = await request(app)
        .get('/api/coaches/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({ college: testNJCAACollege.id })
        .expect(200);

      const players = searchResponse.body.data.players;
      
      // Devrait voir 2 joueurs (le 3ème est caché)
      expect(players).toHaveLength(2);
      expect(players.every(p => p.isProfileVisible)).toBe(true);
      
      // Vérifier qu'on ne voit pas le joueur caché
      const hiddenPlayer = players.find(p => p.user.firstName === 'Solid');
      expect(hiddenPlayer).toBeUndefined();
    });

    test('Should support advanced search with multiple criteria', async () => {
      const searchResponse = await request(app)
        .get('/api/coaches/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({
          minHeight: 175,
          maxHeight: 185,
          minGPA: 3.0,
          graduationYear: 2025,
          sortBy: 'gpa',
          sortOrder: 'desc'
        })
        .expect(200);

      const players = searchResponse.body.data.players;
      expect(players.length).toBeGreaterThan(0);
      
      // Vérifier les critères de filtrage
      players.forEach(player => {
        expect(player.height).toBeGreaterThanOrEqual(175);
        expect(player.height).toBeLessThanOrEqual(185);
        expect(player.gpa).toBeGreaterThanOrEqual(3.0);
      });

      // Vérifier le tri par GPA décroissant
      for (let i = 1; i < players.length; i++) {
        expect(players[i-1].gpa).toBeGreaterThanOrEqual(players[i].gpa);
      }
    });

    test('Should support pagination in search results', async () => {
      const searchResponse = await request(app)
        .get('/api/coaches/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({
          page: 1,
          limit: 1
        })
        .expect(200);

      expect(searchResponse.body.data.players).toHaveLength(1);
      expect(searchResponse.body.data.pagination).toBeDefined();
      expect(searchResponse.body.data.pagination.currentPage).toBe(1);
      expect(searchResponse.body.data.pagination.totalItems).toBeGreaterThan(0);
    });

    test('Should track search history for analytics', async () => {
      // Effectuer plusieurs recherches
      await request(app)
        .get('/api/coaches/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({ position: 'midfielder' });

      await request(app)
        .get('/api/coaches/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({ position: 'forward' });

      // Vérifier que l'historique est enregistré
      const analyticsResponse = await request(app)
        .get('/api/coaches/analytics')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(analyticsResponse.body.data.searchHistory).toBeDefined();
      expect(analyticsResponse.body.data.searchHistory.length).toBeGreaterThan(0);
    });
  });

  describe('⭐ Favorites and Prospect Management', () => {
    test('Should add player to favorites successfully', async () => {
      const playerId = testPlayers[0].profile.id;

      const favoriteResponse = await request(app)
        .post(`/api/coaches/favorites/${playerId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          notes: 'Excellent midfielder with great potential',
          priority: 'high',
          tags: ['midfielder', 'sophomore', 'transfer-target']
        })
        .expect(201);

      TestHelpers.expectSuccessResponse(favoriteResponse, 201);
      expect(favoriteResponse.body.data.added).toBe(true);
      expect(favoriteResponse.body.data.totalFavorites).toBe(1);
    });

    test('Should get list of favorite players', async () => {
      // Ajouter quelques joueurs aux favoris
      const player1Id = testPlayers[0].profile.id;
      const player2Id = testPlayers[1].profile.id;

      await request(app)
        .post(`/api/coaches/favorites/${player1Id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ notes: 'Top prospect', priority: 'high' });

      await request(app)
        .post(`/api/coaches/favorites/${player2Id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ notes: 'Backup option', priority: 'medium' });

      // Récupérer la liste des favoris
      const favoritesResponse = await request(app)
        .get('/api/coaches/favorites')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(favoritesResponse);
      expect(favoritesResponse.body.data.favorites).toHaveLength(2);
      
      const favorites = favoritesResponse.body.data.favorites;
      expect(favorites[0]).toHaveProperty('player');
      expect(favorites[0]).toHaveProperty('notes');
      expect(favorites[0]).toHaveProperty('priority');
      expect(favorites[0].player.user).toBeDefined();
    });

    test('Should remove player from favorites', async () => {
      const playerId = testPlayers[0].profile.id;

      // Ajouter aux favoris
      await request(app)
        .post(`/api/coaches/favorites/${playerId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ notes: 'Test favorite' });

      // Retirer des favoris
      const removeResponse = await request(app)
        .delete(`/api/coaches/favorites/${playerId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(removeResponse);
      expect(removeResponse.body.data.removed).toBe(true);

      // Vérifier que la liste est vide
      const favoritesResponse = await request(app)
        .get('/api/coaches/favorites')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(favoritesResponse.body.data.favorites).toHaveLength(0);
    });

    test('Should update favorite player notes and priority', async () => {
      const playerId = testPlayers[0].profile.id;

      // Ajouter aux favoris
      await request(app)
        .post(`/api/coaches/favorites/${playerId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ 
          notes: 'Initial notes',
          priority: 'medium'
        });

      // Mettre à jour les informations
      const updateResponse = await request(app)
        .put(`/api/coaches/favorites/${playerId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          notes: 'Updated evaluation after game film review',
          priority: 'high',
          tags: ['starter-potential', 'immediate-impact']
        })
        .expect(200);

      TestHelpers.expectSuccessResponse(updateResponse);
      expect(updateResponse.body.data.updated).toBe(true);

      // Vérifier les changements
      const favoritesResponse = await request(app)
        .get('/api/coaches/favorites')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      const favorite = favoritesResponse.body.data.favorites[0];
      expect(favorite.notes).toBe('Updated evaluation after game film review');
      expect(favorite.priority).toBe('high');
    });

    test('Should prevent duplicate favorites', async () => {
      const playerId = testPlayers[0].profile.id;

      // Première addition
      await request(app)
        .post(`/api/coaches/favorites/${playerId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ notes: 'First addition' });

      // Tentative d'addition en double
      const duplicateResponse = await request(app)
        .post(`/api/coaches/favorites/${playerId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ notes: 'Duplicate addition' })
        .expect(409);

      TestHelpers.expectErrorResponse(duplicateResponse, 409);
      expect(duplicateResponse.body.message).toContain('already in favorites');
    });
  });

  describe('📈 Recruitment Analytics and Insights', () => {
    beforeEach(async () => {
      // Créer une activité de recrutement pour les tests d'analytics
      const playerId = testPlayers[0].profile.id;
      
      // Ajouter aux favoris
      await request(app)
        .post(`/api/coaches/favorites/${playerId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ notes: 'Analytics test player' });

      // Effectuer quelques recherches
      await request(app)
        .get('/api/coaches/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({ position: 'midfielder' });
    });

    test('Should provide comprehensive recruitment analytics', async () => {
      const analyticsResponse = await request(app)
        .get('/api/coaches/analytics')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(analyticsResponse);
      const analytics = analyticsResponse.body.data;

      expect(analytics).toHaveProperty('searchHistory');
      expect(analytics).toHaveProperty('playerInteractions');
      expect(analytics).toHaveProperty('recruitmentTrends');
      expect(analytics).toHaveProperty('performanceMetrics');
      
      // Vérifier la présence des métriques clés
      expect(analytics.performanceMetrics).toHaveProperty('totalSearches');
      expect(analytics.performanceMetrics).toHaveProperty('favoritesAdded');
      expect(analytics.performanceMetrics).toHaveProperty('averageSessionTime');
    });

    test('Should track search patterns and trends', async () => {
      // Effectuer plusieurs recherches avec différents critères
      const searchCriteria = [
        { position: 'midfielder', minGPA: 3.0 },
        { position: 'forward', currentYear: 'freshman' },
        { college: testNJCAACollege.id, minHeight: 175 }
      ];

      for (const criteria of searchCriteria) {
        await request(app)
          .get('/api/coaches/search')
          .set('Authorization', `Bearer ${coachToken}`)
          .query(criteria);
      }

      const analyticsResponse = await request(app)
        .get('/api/coaches/analytics')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      const searchHistory = analyticsResponse.body.data.searchHistory;
      expect(searchHistory.length).toBeGreaterThanOrEqual(3);
      
      // Vérifier que les critères de recherche sont enregistrés
      const lastSearch = searchHistory[0]; // Plus récent en premier
      expect(lastSearch).toHaveProperty('criteria');
      expect(lastSearch).toHaveProperty('resultsCount');
      expect(lastSearch).toHaveProperty('timestamp');
    });

    test('Should provide recruitment performance insights', async () => {
      const analyticsResponse = await request(app)
        .get('/api/coaches/analytics')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      const insights = analyticsResponse.body.data.recruitmentTrends;
      
      expect(insights).toHaveProperty('topPositionsSearched');
      expect(insights).toHaveProperty('averageGPATargeted');
      expect(insights).toHaveProperty('preferredRegions');
      expect(insights).toHaveProperty('searchFrequency');
    });

    test('Should filter analytics by date range', async () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const analyticsResponse = await request(app)
        .get('/api/coaches/analytics')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({
          startDate: oneWeekAgo.toISOString(),
          endDate: tomorrow.toISOString()
        })
        .expect(200);

      TestHelpers.expectSuccessResponse(analyticsResponse);
      expect(analyticsResponse.body.data.dateRange).toBeDefined();
      expect(analyticsResponse.body.data.dateRange.start).toBeDefined();
      expect(analyticsResponse.body.data.dateRange.end).toBeDefined();
    });
  });

  describe('🔒 Security and Authorization', () => {
    test('Should enforce coach-only access to recruitment features', async () => {
      const playerData = await TestHelpers.createTestPlayer();
      const playerToken = playerData.getAuthToken();

      const restrictedRoutes = [
        '/api/coaches/dashboard',
        '/api/coaches/search',
        '/api/coaches/favorites',
        '/api/coaches/analytics'
      ];

      for (const route of restrictedRoutes) {
        const response = await request(app)
          .get(route)
          .set('Authorization', `Bearer ${playerToken}`)
          .expect(403);

        TestHelpers.expectErrorResponse(response, 403);
      }
    });

    test('Should prevent unauthorized access to coach data', async () => {
      const otherCoachData = await TestHelpers.createTestCoach();
      const otherCoachToken = otherCoachData.getAuthToken();

      // Un coach ne devrait pas voir les favoris d'un autre coach
      const favoritesResponse = await request(app)
        .get('/api/coaches/favorites')
        .set('Authorization', `Bearer ${otherCoachToken}`)
        .expect(200);

      // La liste devrait être vide (pas les favoris du premier coach)
      expect(favoritesResponse.body.data.favorites).toHaveLength(0);
    });

    test('Should validate search parameters to prevent injection attacks', async () => {
      const maliciousQueries = [
        { position: '<script>alert("xss")</script>' },
        { minGPA: 'DROP TABLE players' },
        { college: '1 OR 1=1' }
      ];

      for (const maliciousQuery of maliciousQueries) {
        const response = await request(app)
          .get('/api/coaches/search')
          .set('Authorization', `Bearer ${coachToken}`)
          .query(maliciousQuery)
          .expect(400);

        TestHelpers.expectErrorResponse(response, 400);
      }
    });

    test('Should rate limit intensive search operations', async () => {
      // Effectuer de nombreuses recherches rapidement
      const searchPromises = Array(15).fill().map(() =>
        request(app)
          .get('/api/coaches/search')
          .set('Authorization', `Bearer ${coachToken}`)
          .query({ position: 'midfielder' })
      );

      const responses = await Promise.all(searchPromises);
      
      // Certaines requêtes devraient être limitées
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('⚡ Performance and Scalability', () => {
    test('Should handle large search datasets efficiently', async () => {
      // Créer de nombreux joueurs pour tester la performance
      const playerPromises = Array(50).fill().map((_, i) =>
        TestHelpers.createTestPlayer({
          college: testNJCAACollege,
          user: {
            firstName: `Player${i}`,
            lastName: 'Performance'
          },
          profile: {
            position: ['midfielder', 'forward', 'defender'][i % 3],
            currentYear: ['freshman', 'sophomore'][i % 2],
            gpa: 3.0 + (i % 10) * 0.1,
            isProfileVisible: true
          }
        })
      );

      await Promise.all(playerPromises);

      const startTime = Date.now();
      const searchResponse = await request(app)
        .get('/api/coaches/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({ college: testNJCAACollege.id })
        .expect(200);
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(2000); // Moins de 2 secondes
      expect(searchResponse.body.data.players.length).toBeGreaterThan(20);
    });

    test('Should optimize repeated searches with caching', async () => {
      const searchQuery = { 
        position: 'midfielder',
        college: testNJCAACollege.id
      };

      // Première recherche
      const firstSearch = Date.now();
      await request(app)
        .get('/api/coaches/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query(searchQuery)
        .expect(200);
      const firstSearchTime = Date.now() - firstSearch;

      // Recherche répétée (potentiellement cachée)
      const secondSearch = Date.now();
      await request(app)
        .get('/api/coaches/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query(searchQuery)
        .expect(200);
      const secondSearchTime = Date.now() - secondSearch;

      // La deuxième recherche devrait être plus rapide ou similaire
      expect(secondSearchTime).toBeLessThanOrEqual(firstSearchTime + 100);
    });

    test('Should handle concurrent favorite operations safely', async () => {
      const playerId = testPlayers[0].profile.id;

      // Opérations simultanées sur les favoris
      const operations = [
        request(app)
          .post(`/api/coaches/favorites/${playerId}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send({ notes: 'Concurrent add 1' }),
        request(app)
          .post(`/api/coaches/favorites/${playerId}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .send({ notes: 'Concurrent add 2' })
      ];

      const responses = await Promise.all(operations);
      
      // Une seule opération devrait réussir, l'autre devrait échouer (409)
      const successCount = responses.filter(r => r.status === 201).length;
      const conflictCount = responses.filter(r => r.status === 409).length;
      
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);
    });
  });
});