// portall/server/tests/integration/api/playerRoutes.test.js

process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../../server');
const TestHelpers = require('../../utils/testHelpers');
const { User, PlayerProfile, NJCAACollege } = require('../../../models');

/**
 * 👤 Tests d'intégration des routes Players - Cœur métier des joueurs NJCAA
 * 
 * Ces tests valident l'écosystème complet des fonctionnalités joueur, depuis la gestion
 * de profil jusqu'aux analytics de visibilité. Les joueurs sont le "produit" de votre
 * plateforme - ils créent leur profil pour être découverts par les coachs.
 * 
 * 🎯 Concept pédagogique : "Product-Centric Testing"
 * Dans une marketplace comme Portall, les joueurs sont les "produits" que les coachs
 * "achètent" (recrutent). Ces tests valident que le "produit" (profil joueur) fonctionne
 * parfaitement : création, mise à jour, visibilité, analytics.
 * 
 * 💡 Écosystème joueur testé :
 * - Dashboard personnel avec métriques
 * - Gestion de profil et visibilité
 * - Analytics de vues et interactions
 * - Recherche et découvrabilité
 * - Interactions avec les autres types d'utilisateurs
 * 
 * 🔧 Points de validation critiques :
 * - Contrôle de la vie privée (profil public/privé)
 * - Métriques de performance (vues, intérêt des coachs)
 * - Qualité des données de profil
 * - Intégration avec le système de recrutement
 */

describe('👤 Player Routes Integration - Complete Player Ecosystem', () => {
  let testCollege;
  let testPlayer;
  let playerToken;
  let testCoach;
  let coachToken;
  let testAdmin;
  let adminToken;

  beforeAll(async () => {
    testCollege = await TestHelpers.createTestNJCAACollege({
      name: 'Metropolitan Community College',
      state: 'NV',
      division: 'division_1'
    });
  });

  beforeEach(async () => {
    await TestHelpers.cleanupTestData();

    // Créer les utilisateurs de test pour les interactions
    const playerData = await TestHelpers.createTestPlayer({
      college: testCollege,
      user: {
        email: 'player.integration@example.com',
        firstName: 'Integration',
        lastName: 'Player'
      },
      profile: {
        position: 'midfielder',
        currentYear: 'sophomore',
        gpa: 3.4,
        isProfileVisible: true
      }
    });
    testPlayer = playerData.user;
    playerToken = playerData.getAuthToken();

    const coachData = await TestHelpers.createTestCoach({
      user: {
        email: 'coach.integration@example.com'
      }
    });
    testCoach = coachData.user;
    coachToken = coachData.getAuthToken();

    const adminData = await TestHelpers.createTestAdmin({
      email: 'admin.integration@example.com'
    });
    testAdmin = adminData.user;
    adminToken = adminData.getAuthToken();
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('🏥 Health Check and Service Discovery', () => {
    test('Should return comprehensive player service status', async () => {
      const response = await request(app)
        .get('/api/players/health')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('Player routes');
      expect(response.body.availableEndpoints).toBeDefined();
      expect(response.body.availableEndpoints).toHaveProperty('dashboard');
      expect(response.body.availableEndpoints).toHaveProperty('updateProfile');
      expect(response.body.availableEndpoints).toHaveProperty('search');
    });
  });

  describe('📊 Player Dashboard and Personal Analytics', () => {
    test('Should get comprehensive player dashboard with all metrics', async () => {
      const response = await request(app)
        .get('/api/players/dashboard')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('player');
      expect(response.body.data).toHaveProperty('profile');
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data).toHaveProperty('recentActivity');

      // Vérifier les données du joueur
      expect(response.body.data.player.firstName).toBe('Integration');
      expect(response.body.data.profile.position).toBe('midfielder');
      expect(response.body.data.profile.college).toBeDefined();

      // Vérifier les statistiques
      expect(response.body.data.stats).toHaveProperty('profileViews');
      expect(response.body.data.stats).toHaveProperty('coachInteractions');
      expect(response.body.data.stats).toHaveProperty('profileCompletion');
    });

    test('Should get detailed player analytics', async () => {
      const response = await request(app)
        .get('/api/players/analytics')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('viewsOverTime');
      expect(response.body.data).toHaveProperty('topCoachViews');
      expect(response.body.data).toHaveProperty('profilePerformance');
      expect(response.body.data).toHaveProperty('recommendations');
    });

    test('Should reject unauthorized dashboard access', async () => {
      const response = await request(app)
        .get('/api/players/dashboard')
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
    });

    test('Should reject non-player dashboard access', async () => {
      const response = await request(app)
        .get('/api/players/dashboard')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(403);

      TestHelpers.expectErrorResponse(response, 403);
      expect(response.body.message).toContain('player');
    });
  });

  describe('👤 Profile Management and Updates', () => {
    test('Should update player profile successfully with comprehensive data', async () => {
      const profileUpdates = {
        height: 180,
        weight: 75,
        position: 'forward',
        currentYear: 'junior',
        gpa: 3.6,
        bio: 'Dedicated midfielder with strong leadership skills and tactical awareness.',
        achievements: [
          'Team Captain 2023',
          'Leading scorer in conference',
          'Academic All-American'
        ],
        preferredFoot: 'right',
        languages: ['English', 'Spanish']
      };

      const response = await request(app)
        .put('/api/players/profile')
        .set('Authorization', `Bearer ${playerToken}`)
        .send(profileUpdates)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.position).toBe('forward');
      expect(response.body.data.gpa).toBe(3.6);
      expect(response.body.data.bio).toContain('leadership skills');

      // Vérifier que les changements persistent en base
      const profileInDB = await PlayerProfile.findOne({
        where: { userId: testPlayer.id }
      });
      expect(profileInDB.position).toBe('forward');
      expect(profileInDB.currentYear).toBe('junior');
    });

    test('Should validate profile update data properly', async () => {
      const invalidUpdates = [
        // GPA invalide
        {
          gpa: 5.0, // Trop élevé
          position: 'midfielder'
        },
        // Poids invalide
        {
          weight: 30, // Trop léger
          position: 'midfielder'
        },
        // Position invalide
        {
          position: 'invalid_position',
          gpa: 3.0
        }
      ];

      for (const invalidData of invalidUpdates) {
        const response = await request(app)
          .put('/api/players/profile')
          .set('Authorization', `Bearer ${playerToken}`)
          .send(invalidData)
          .expect(400);

        TestHelpers.expectErrorResponse(response, 400);
      }
    });

    test('Should handle partial profile updates correctly', async () => {
      // Mise à jour partielle (seulement quelques champs)
      const partialUpdate = {
        bio: 'Updated bio with new information about my playing style.'
      };

      const response = await request(app)
        .put('/api/players/profile')
        .set('Authorization', `Bearer ${playerToken}`)
        .send(partialUpdate)
        .expect(200);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.bio).toBe('Updated bio with new information about my playing style.');
      
      // Vérifier que les autres champs n'ont pas changé
      expect(response.body.data.position).toBe('midfielder'); // Valeur originale
    });
  });

  describe('👁️ Profile Visibility and Privacy Controls', () => {
    test('Should toggle profile visibility successfully', async () => {
      // Vérifier l'état initial (visible)
      let profile = await PlayerProfile.findOne({ where: { userId: testPlayer.id } });
      expect(profile.isProfileVisible).toBe(true);

      // Rendre le profil privé
      const hideResponse = await request(app)
        .post('/api/players/profile/visibility')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ isVisible: false })
        .expect(200);

      TestHelpers.expectSuccessResponse(hideResponse);
      expect(hideResponse.body.data.isProfileVisible).toBe(false);

      // Vérifier en base de données
      profile = await PlayerProfile.findOne({ where: { userId: testPlayer.id } });
      expect(profile.isProfileVisible).toBe(false);

      // Rendre le profil public à nouveau
      const showResponse = await request(app)
        .post('/api/players/profile/visibility')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ isVisible: true })
        .expect(200);

      expect(showResponse.body.data.isProfileVisible).toBe(true);
    });

    test('Should respect privacy when profile is hidden', async () => {
      // Rendre le profil privé
      await request(app)
        .post('/api/players/profile/visibility')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ isVisible: false });

      // Un coach ne devrait pas pouvoir voir le profil dans les recherches
      const searchResponse = await request(app)
        .get('/api/players/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({ college: testCollege.id })
        .expect(200);

      // Le profil caché ne devrait pas apparaître dans les résultats
      const profiles = searchResponse.body.data.players;
      const hiddenProfile = profiles.find(p => p.userId === testPlayer.id);
      expect(hiddenProfile).toBeUndefined();
    });
  });

  describe('🔍 Profile Discovery and Search', () => {
    test('Should allow coaches to search and view player profiles', async () => {
      const searchResponse = await request(app)
        .get('/api/players/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({
          position: 'midfielder',
          college: testCollege.id,
          minGPA: 3.0
        })
        .expect(200);

      TestHelpers.expectSuccessResponse(searchResponse);
      expect(searchResponse.body.data.players).toHaveLength(1);
      
      const foundPlayer = searchResponse.body.data.players[0];
      expect(foundPlayer.position).toBe('midfielder');
      expect(foundPlayer.gpa).toBeGreaterThanOrEqual(3.0);
      expect(foundPlayer.user.firstName).toBe('Integration');
    });

    test('Should allow coaches to view specific player profiles', async () => {
      const profileResponse = await request(app)
        .get(`/api/players/${testPlayer.id}/profile`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(profileResponse);
      expect(profileResponse.body.data.user.firstName).toBe('Integration');
      expect(profileResponse.body.data.profile.position).toBe('midfielder');
      expect(profileResponse.body.data.college).toBeDefined();

      // Vérifier que les données sensibles ne sont pas exposées
      expect(profileResponse.body.data.user).not.toHaveProperty('password');
    });

    test('Should allow admins to view player profiles', async () => {
      const profileResponse = await request(app)
        .get(`/api/players/${testPlayer.id}/profile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(profileResponse);
      expect(profileResponse.body.data.user.firstName).toBe('Integration');
    });

    test('Should prevent unauthorized profile viewing', async () => {
      const response = await request(app)
        .get(`/api/players/${testPlayer.id}/profile`)
        .expect(401);

      TestHelpers.expectErrorResponse(response, 401);
    });

    test('Should handle non-existent player profile gracefully', async () => {
      const response = await request(app)
        .get('/api/players/99999/profile')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(404);

      TestHelpers.expectErrorResponse(response, 404);
    });
  });

  describe('📈 Profile View Tracking and Analytics', () => {
    test('Should record profile views from coaches', async () => {
      const viewResponse = await request(app)
        .post(`/api/players/${testPlayer.id}/view`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          source: 'search_results',
          metadata: {
            searchQuery: 'midfielder',
            position: 1 // Position dans les résultats
          }
        })
        .expect(201);

      TestHelpers.expectSuccessResponse(viewResponse, 201);
      expect(viewResponse.body.data.viewRecorded).toBe(true);
      expect(viewResponse.body.data.totalViews).toBeGreaterThan(0);
    });

    test('Should track multiple views and increment counters', async () => {
      // Première vue
      await request(app)
        .post(`/api/players/${testPlayer.id}/view`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ source: 'search_results' });

      // Deuxième vue
      const secondViewResponse = await request(app)
        .post(`/api/players/${testPlayer.id}/view`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ source: 'direct_link' })
        .expect(201);

      expect(secondViewResponse.body.data.totalViews).toBeGreaterThanOrEqual(2);
    });

    test('Should include view analytics in player dashboard', async () => {
      // Enregistrer quelques vues
      await request(app)
        .post(`/api/players/${testPlayer.id}/view`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ source: 'search_results' });

      // Vérifier que les analytics sont mises à jour
      const dashboardResponse = await request(app)
        .get('/api/players/dashboard')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(dashboardResponse.body.data.stats.profileViews).toBeGreaterThan(0);
    });

    test('Should prevent players from viewing their own profile stats incorrectly', async () => {
      // Un joueur ne devrait pas pouvoir enregistrer des vues sur son propre profil
      const response = await request(app)
        .post(`/api/players/${testPlayer.id}/view`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ source: 'self_view' })
        .expect(403);

      TestHelpers.expectErrorResponse(response, 403);
    });
  });

  describe('🔍 Advanced Search and Filtering', () => {
    beforeEach(async () => {
      // Créer plusieurs joueurs avec des profils variés pour tester la recherche
      await TestHelpers.createTestPlayer({
        college: testCollege,
        user: { firstName: 'Forward', lastName: 'Player' },
        profile: {
          position: 'forward',
          currentYear: 'freshman',
          gpa: 3.8,
          height: 185,
          isProfileVisible: true
        }
      });

      await TestHelpers.createTestPlayer({
        college: testCollege,
        user: { firstName: 'Defender', lastName: 'Player' },
        profile: {
          position: 'defender',
          currentYear: 'senior',
          gpa: 3.2,
          height: 175,
          isProfileVisible: true
        }
      });
    });

    test('Should filter players by position correctly', async () => {
      const response = await request(app)
        .get('/api/players/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({ position: 'forward' })
        .expect(200);

      const players = response.body.data.players;
      expect(players).toHaveLength(1);
      expect(players[0].position).toBe('forward');
      expect(players[0].user.firstName).toBe('Forward');
    });

    test('Should filter players by academic year', async () => {
      const response = await request(app)
        .get('/api/players/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({ currentYear: 'freshman' })
        .expect(200);

      const players = response.body.data.players;
      expect(players).toHaveLength(1);
      expect(players[0].currentYear).toBe('freshman');
    });

    test('Should filter players by GPA range', async () => {
      const response = await request(app)
        .get('/api/players/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({ 
          minGPA: 3.5,
          maxGPA: 4.0
        })
        .expect(200);

      const players = response.body.data.players;
      expect(players.every(p => p.gpa >= 3.5 && p.gpa <= 4.0)).toBe(true);
    });

    test('Should combine multiple search filters', async () => {
      const response = await request(app)
        .get('/api/players/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({
          college: testCollege.id,
          minGPA: 3.0,
          currentYear: 'sophomore'
        })
        .expect(200);

      const players = response.body.data.players;
      expect(players).toHaveLength(1);
      expect(players[0].currentYear).toBe('sophomore');
      expect(players[0].gpa).toBeGreaterThanOrEqual(3.0);
    });

    test('Should support pagination in search results', async () => {
      const response = await request(app)
        .get('/api/players/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({
          page: 1,
          limit: 2
        })
        .expect(200);

      expect(response.body.data.players.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalItems).toBeGreaterThan(0);
    });

    test('Should sort search results correctly', async () => {
      const response = await request(app)
        .get('/api/players/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({
          sortBy: 'gpa',
          sortOrder: 'desc'
        })
        .expect(200);

      const players = response.body.data.players;
      expect(players.length).toBeGreaterThan(1);
      
      // Vérifier que les résultats sont triés par GPA décroissant
      for (let i = 1; i < players.length; i++) {
        expect(players[i-1].gpa).toBeGreaterThanOrEqual(players[i].gpa);
      }
    });
  });

  describe('🔒 Security and Authorization', () => {
    test('Should enforce player-only access to personal dashboard', async () => {
      const response = await request(app)
        .get('/api/players/dashboard')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(403);

      TestHelpers.expectErrorResponse(response, 403);
    });

    test('Should enforce authentication for all player routes', async () => {
      const protectedRoutes = [
        '/api/players/dashboard',
        '/api/players/analytics',
        '/api/players/profile'
      ];

      for (const route of protectedRoutes) {
        const response = await request(app)
          .get(route)
          .expect(401);

        TestHelpers.expectErrorResponse(response, 401);
      }
    });

    test('Should prevent cross-player data access', async () => {
      // Créer un second joueur
      const otherPlayerData = await TestHelpers.createTestPlayer({
        college: testCollege
      });
      const otherPlayerToken = otherPlayerData.getAuthToken();

      // Le premier joueur ne devrait pas pouvoir modifier le profil du second
      const response = await request(app)
        .put('/api/players/profile')
        .set('Authorization', `Bearer ${otherPlayerToken}`)
        .send({ bio: 'This should not affect the other player' })
        .expect(200);

      // Mais la modification ne devrait affecter que son propre profil
      const originalProfile = await PlayerProfile.findOne({
        where: { userId: testPlayer.id }
      });
      expect(originalProfile.bio).not.toBe('This should not affect the other player');
    });

    test('Should sanitize user input in profile updates', async () => {
      const maliciousInput = {
        bio: '<script>alert("xss")</script>Malicious bio content',
        achievements: ['<img src="x" onerror="alert(1)">', 'Valid achievement']
      };

      const response = await request(app)
        .put('/api/players/profile')
        .set('Authorization', `Bearer ${playerToken}`)
        .send(maliciousInput)
        .expect(200);

      // Vérifier que le contenu malicieux a été sanitisé
      expect(response.body.data.bio).not.toContain('<script>');
      expect(response.body.data.bio).not.toContain('onerror');
    });
  });

  describe('⚡ Performance and Optimization', () => {
    test('Should handle large search result sets efficiently', async () => {
      // Créer beaucoup de joueurs pour tester la performance
      const playerPromises = Array(20).fill().map((_, i) =>
        TestHelpers.createTestPlayer({
          college: testCollege,
          user: {
            firstName: `Player${i}`,
            lastName: 'Performance'
          },
          profile: {
            position: ['midfielder', 'forward', 'defender'][i % 3],
            isProfileVisible: true
          }
        })
      );

      await Promise.all(playerPromises);

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/players/search')
        .set('Authorization', `Bearer ${coachToken}`)
        .query({ college: testCollege.id })
        .expect(200);
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(1000); // Moins d'une seconde
      expect(response.body.data.players.length).toBeGreaterThan(10);
    });

    test('Should cache frequently accessed data appropriately', async () => {
      // Première requête vers le dashboard (pas de cache)
      const firstRequest = Date.now();
      await request(app)
        .get('/api/players/dashboard')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);
      const firstRequestTime = Date.now() - firstRequest;

      // Deuxième requête (potentiellement cachée)
      const secondRequest = Date.now();
      await request(app)
        .get('/api/players/dashboard')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);
      const secondRequestTime = Date.now() - secondRequest;

      // La deuxième requête devrait être similaire ou plus rapide
      expect(secondRequestTime).toBeLessThanOrEqual(firstRequestTime + 50);
    });

    test('Should handle concurrent profile updates safely', async () => {
      // Plusieurs mises à jour simultanées du même profil
      const updates = [
        { bio: 'Update 1' },
        { bio: 'Update 2' },
        { bio: 'Update 3' }
      ];

      const promises = updates.map(update =>
        request(app)
          .put('/api/players/profile')
          .set('Authorization', `Bearer ${playerToken}`)
          .send(update)
      );

      const responses = await Promise.all(promises);
      
      // Toutes les requêtes devraient réussir
      expect(responses.every(r => r.status === 200)).toBe(true);

      // La dernière mise à jour devrait être persistée
      const finalProfile = await PlayerProfile.findOne({
        where: { userId: testPlayer.id }
      });
      expect(['Update 1', 'Update 2', 'Update 3']).toContain(finalProfile.bio);
    });
  });
});