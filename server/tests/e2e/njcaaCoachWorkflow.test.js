// portall/server/tests/e2e/njcaaCoachWorkflow.test.js

process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../server');
const TestHelpers = require('../utils/testHelpers');
const { User, NJCAACoachProfile, PlayerProfile } = require('../../models');

/**
 * 🌟 Tests End-to-End du workflow NJCAA Coach - Parcours utilisateur complet
 * 
 * Ces tests simulent un parcours utilisateur complet depuis l'inscription d'un
 * coach NJCAA jusqu'à l'évaluation de joueurs, en passant par tous les écrans
 * et fonctionnalités de la plateforme.
 * 
 * 🎯 Concept pédagogique : "User Journey Testing"
 * Un test E2E suit le parcours d'un utilisateur réel sur votre plateforme.
 * C'est comme suivre un client dans votre magasin depuis l'entrée jusqu'à
 * l'achat, en s'assurant que chaque étape fonctionne parfaitement.
 * 
 * 💡 Workflow NJCAA Coach testé :
 * 1. 📝 Inscription avec profil complet
 * 2. 🔐 Connexion et authentification
 * 3. 📊 Accès au dashboard et découverte des fonctionnalités
 * 4. 👥 Gestion et filtrage des joueurs
 * 5. ⭐ Évaluation de joueurs avec feedback
 * 6. 📈 Consultation des analytics et statistiques
 * 7. ⚙️ Mise à jour du profil
 * 8. 🚪 Déconnexion sécurisée
 * 
 * 🔧 Réalisme des tests :
 * - Données réalistes simulant de vrais utilisateurs
 * - Timing et séquences naturelles
 * - Gestion des états et transitions
 * - Validation des effets de bord complets
 */

describe('🌟 NJCAA Coach Complete User Journey - Phase 5B E2E Workflow', () => {
  let testCollege;
  let userSession; // Simule une session utilisateur complète

  beforeAll(async () => {
    // Préparer l'environnement de test
    testCollege = await TestHelpers.createTestNJCAACollege({
      name: 'Riverside Community College',
      state: 'CA',
      region: 'West',
      division: 'division_1'
    });

    // Initialiser une session utilisateur
    userSession = {
      user: null,
      tokens: null,
      profile: null,
      dashboardData: null,
      evaluationHistory: []
    };
  });

  beforeEach(async () => {
    await TestHelpers.cleanupTestData();
    // Réinitialiser la session
    userSession = {
      user: null,
      tokens: null,
      profile: null,
      dashboardData: null,
      evaluationHistory: []
    };
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('🚀 Complete User Journey: From Registration to Expert Usage', () => {
    test('📝 STEP 1: Coach registration with complete profile setup', async () => {
      console.log('🎬 Starting NJCAA Coach User Journey...');
      
      const registrationData = {
        user: {
          email: 'coach.martinez@riverside.edu',
          password: 'SecureCoaching2024!',
          firstName: 'Carlos',
          lastName: 'Martinez',
          userType: 'njcaa_coach'
        },
        profile: {
          position: 'head_coach',
          phoneNumber: '+1-555-123-4567',
          collegeId: testCollege.id,
          division: 'njcaa_d1',
          teamSport: 'mens_soccer'
        }
      };

      console.log('📧 Submitting registration form...');
      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      // Valider la réponse d'inscription
      TestHelpers.expectValidJWTResponse(registrationResponse);
      expect(registrationResponse.body.data.user.firstName).toBe('Carlos');
      expect(registrationResponse.body.data.user.userType).toBe('njcaa_coach');

      // Sauvegarder les données de session
      userSession.user = registrationResponse.body.data.user;
      userSession.tokens = registrationResponse.body.data.tokens;

      console.log('✅ Registration completed successfully');
      console.log(`👤 User ID: ${userSession.user.id}`);
      console.log(`🎫 Access token received: ${userSession.tokens.accessToken.substring(0, 20)}...`);

      // Vérifier que les données sont bien en base
      const userInDB = await User.findByPk(userSession.user.id);
      expect(userInDB.email).toBe('coach.martinez@riverside.edu');
      
      const profileInDB = await NJCAACoachProfile.findOne({
        where: { userId: userSession.user.id }
      });
      expect(profileInDB.position).toBe('head_coach');
      expect(profileInDB.teamSport).toBe('mens_soccer');
      expect(profileInDB.totalEvaluations).toBe(0); // Nouveau coach
    });

    test('🔐 STEP 2: Login and dashboard access', async () => {
      // S'assurer qu'un utilisateur existe pour ce test
      if (!userSession.user) {
        const userData = await TestHelpers.createTestNJCAACoach({
          college: testCollege,
          user: {
            email: 'coach.martinez@riverside.edu',
            firstName: 'Carlos',
            lastName: 'Martinez'
          }
        });
        userSession.user = userData.user;
      }

      console.log('🔑 Logging in with credentials...');
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'coach.martinez@riverside.edu',
          password: 'TestPassword123!' // Mot de passe par défaut des helpers
        })
        .expect(200);

      TestHelpers.expectValidJWTResponse(loginResponse);
      userSession.tokens = loginResponse.body.data.tokens;

      console.log('🏠 Accessing dashboard...');
      const dashboardResponse = await request(app)
        .get('/api/njcaa-coaches/dashboard')
        .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(dashboardResponse);
      userSession.dashboardData = dashboardResponse.body.data;

      // Valider les données du dashboard
      expect(userSession.dashboardData).toHaveProperty('coach');
      expect(userSession.dashboardData).toHaveProperty('stats');
      expect(userSession.dashboardData.coach.firstName).toBe('Carlos');
      expect(userSession.dashboardData.stats.totalEvaluations).toBe(0);

      console.log('✅ Dashboard loaded successfully');
      console.log(`📊 Total evaluations: ${userSession.dashboardData.stats.totalEvaluations}`);
    });

    test('👥 STEP 3: Discover and manage team players', async () => {
      console.log('👨‍🎓 Creating team players...');
      
      // Créer une équipe de joueurs réaliste
      const teamPlayers = [
        {
          name: 'Diego Rodriguez',
          position: 'midfielder',
          year: 'sophomore',
          gpa: 3.2
        },
        {
          name: 'Marcus Johnson',
          position: 'forward',
          year: 'freshman',
          gpa: 3.8
        },
        {
          name: 'Alex Chen',
          position: 'defender',
          year: 'sophomore',
          gpa: 3.5
        },
        {
          name: 'Jordan Williams',
          position: 'goalkeeper',
          year: 'freshman',
          gpa: 3.0
        }
      ];

      const createdPlayers = [];
      for (const player of teamPlayers) {
        const playerData = await TestHelpers.createTestPlayer({
          college: testCollege,
          user: {
            firstName: player.name.split(' ')[0],
            lastName: player.name.split(' ')[1]
          },
          profile: {
            gender: 'male', // Coach d'équipe masculine
            position: player.position,
            currentYear: player.year,
            gpa: player.gpa,
            isProfileVisible: true
          }
        });
        createdPlayers.push(playerData);
      }

      console.log(`👥 Created ${createdPlayers.length} team players`);

      console.log('📋 Viewing team roster...');
      const playersResponse = await request(app)
        .get('/api/njcaa-coaches/my-players')
        .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(playersResponse);
      const players = playersResponse.body.data.players;

      expect(players).toHaveLength(4); // Tous les joueurs masculins
      expect(players.every(p => p.gender === 'male')).toBe(true);
      expect(players.every(p => p.collegeId === testCollege.id)).toBe(true);

      console.log('✅ Team roster loaded successfully');
      console.log(`👥 Found ${players.length} players in team`);
      
      // Valider la diversité des positions
      const positions = players.map(p => p.position);
      expect(new Set(positions).size).toBeGreaterThan(2); // Au moins 3 positions différentes

      userSession.teamPlayers = players;
    });

    test('⭐ STEP 4: Evaluate players with detailed feedback', async () => {
      console.log('⭐ Starting player evaluations...');

      // Évaluer chaque joueur avec des critères réalistes
      const evaluationsToMake = [
        {
          playerIndex: 0, // Diego Rodriguez (midfielder)
          rating: 4,
          notes: 'Excellent ball control and vision. Shows strong leadership qualities on the field. Needs to work on defensive positioning.',
          skills: {
            technical: 4,
            tactical: 4,
            physical: 3,
            mental: 5
          }
        },
        {
          playerIndex: 1, // Marcus Johnson (forward)
          rating: 5,
          notes: 'Outstanding finishing ability and movement in the box. Great potential for NCAA recruitment. Keep developing his heading.',
          skills: {
            technical: 5,
            tactical: 4,
            physical: 4,
            mental: 4
          }
        },
        {
          playerIndex: 2, // Alex Chen (defender)
          rating: 3,
          notes: 'Solid defensive fundamentals but needs to improve pace. Good communication with teammates. Work on first touch.',
          skills: {
            technical: 3,
            tactical: 4,
            physical: 3,
            mental: 4
          }
        }
      ];

      for (const evaluation of evaluationsToMake) {
        const player = userSession.teamPlayers[evaluation.playerIndex];
        
        console.log(`📝 Evaluating ${player.user.firstName} ${player.user.lastName} (${player.position})`);
        
        const evaluationResponse = await request(app)
          .post('/api/njcaa-coaches/evaluate-player')
          .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
          .send({
            playerId: player.id,
            rating: evaluation.rating,
            notes: evaluation.notes,
            skills: evaluation.skills
          })
          .expect(201);

        TestHelpers.expectSuccessResponse(evaluationResponse, 201);
        userSession.evaluationHistory.push(evaluationResponse.body.data);

        console.log(`✅ Evaluation completed (Rating: ${evaluation.rating}/5)`);
        
        // Petite pause pour simuler le temps de réflexion
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      console.log(`📊 Completed ${evaluationsToMake.length} player evaluations`);

      // Vérifier que les compteurs sont correctement mis à jour
      const updatedProfile = await NJCAACoachProfile.findOne({
        where: { userId: userSession.user.id }
      });
      expect(updatedProfile.totalEvaluations).toBe(3);
      expect(updatedProfile.lastEvaluationDate).toBeInstanceOf(Date);
    });

    test('📈 STEP 5: Review analytics and team performance', async () => {
      console.log('📊 Reviewing team analytics...');

      const statsResponse = await request(app)
        .get('/api/njcaa-coaches/stats')
        .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(statsResponse);
      const stats = statsResponse.body.data;

      expect(stats.totalEvaluations).toBe(3);
      expect(stats.averageRating).toBeCloseTo(4, 1); // (4+5+3)/3 = 4
      expect(stats.evaluationFrequency).toBeDefined();

      console.log(`📈 Average team rating: ${stats.averageRating}/5`);
      console.log(`📊 Total evaluations: ${stats.totalEvaluations}`);

      console.log('🎯 Checking team overview...');
      const overviewResponse = await request(app)
        .get('/api/njcaa-coaches/team-overview')
        .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
        .expect(200);

      const overview = overviewResponse.body.data;
      expect(overview.playerCount).toBe(4);
      expect(overview.averageTeamRating).toBeCloseTo(4, 1);
      expect(overview.playersByPosition).toHaveProperty('midfielder', 1);
      expect(overview.playersByPosition).toHaveProperty('forward', 1);

      console.log('✅ Analytics reviewed successfully');
    });

    test('📝 STEP 6: View evaluation history and manage records', async () => {
      console.log('📋 Reviewing evaluation history...');

      const historyResponse = await request(app)
        .get('/api/njcaa-coaches/my-evaluations')
        .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(historyResponse);
      const evaluations = historyResponse.body.data.evaluations;

      expect(evaluations).toHaveLength(3);
      expect(evaluations[0].notes).toContain('Alex Chen'); // Plus récent en premier
      expect(evaluations.every(e => e.rating >= 1 && e.rating <= 5)).toBe(true);

      console.log(`📋 Found ${evaluations.length} evaluations in history`);
      
      // Vérifier que les évaluations incluent les détails des joueurs
      expect(evaluations[0]).toHaveProperty('player');
      expect(evaluations[0].player).toHaveProperty('user');
      expect(evaluations[0].player.user.firstName).toBeDefined();

      console.log('✅ Evaluation history loaded successfully');
    });

    test('⚙️ STEP 7: Update coach profile and preferences', async () => {
      console.log('⚙️ Updating coach profile...');

      const profileUpdates = {
        position: 'assistant_coach', // Promotion simulée
        phoneNumber: '+1-555-987-6543',
        // Garder le même teamSport pour maintenir l'accès aux joueurs
        bio: 'Experienced soccer coach with 8+ years in player development. Specialized in midfielder training and team tactics.'
      };

      const updateResponse = await request(app)
        .put('/api/njcaa-coaches/profile')
        .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
        .send(profileUpdates)
        .expect(200);

      TestHelpers.expectSuccessResponse(updateResponse);
      expect(updateResponse.body.data.position).toBe('assistant_coach');
      expect(updateResponse.body.data.phoneNumber).toBe('+1-555-987-6543');

      console.log('✅ Profile updated successfully');
      console.log(`📱 New phone: ${updateResponse.body.data.phoneNumber}`);

      // Vérifier que les changements persistent
      const profileResponse = await request(app)
        .get('/api/njcaa-coaches/profile')
        .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
        .expect(200);

      expect(profileResponse.body.data.profile.position).toBe('assistant_coach');
    });

    test('🔄 STEP 8: Token refresh and session management', async () => {
      console.log('🔄 Testing session management...');

      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: userSession.tokens.refreshToken
        })
        .expect(200);

      TestHelpers.expectValidJWTResponse(refreshResponse);
      
      // Mettre à jour les tokens de session
      const oldAccessToken = userSession.tokens.accessToken;
      userSession.tokens = refreshResponse.body.data.tokens;

      expect(userSession.tokens.accessToken).not.toBe(oldAccessToken);
      console.log('✅ Tokens refreshed successfully');

      // Vérifier que le nouveau token fonctionne
      const verificationResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
        .expect(200);

      expect(verificationResponse.body.data.user.id).toBe(userSession.user.id);
      console.log('✅ New token verified and working');
    });

    test('🚪 STEP 9: Secure logout and session cleanup', async () => {
      console.log('🚪 Logging out securely...');

      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
        .expect(200);

      TestHelpers.expectSuccessResponse(logoutResponse);
      console.log('✅ Logout completed successfully');

      // Vérifier que le token est invalide après déconnexion
      const unauthorizedResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userSession.tokens.accessToken}`)
        .expect(401);

      TestHelpers.expectErrorResponse(unauthorizedResponse, 401);
      console.log('✅ Token invalidated after logout');

      // Nettoyer la session
      userSession = {
        user: null,
        tokens: null,
        profile: null,
        dashboardData: null,
        evaluationHistory: []
      };

      console.log('🧹 Session cleaned up');
    });

    test('🎉 STEP 10: Journey completion validation', async () => {
      console.log('🎉 Validating complete journey...');

      // Vérifier que toutes les données persistent en base
      const finalUser = await User.findOne({
        where: { email: 'coach.martinez@riverside.edu' }
      });
      expect(finalUser).toBeDefined();
      expect(finalUser.firstName).toBe('Carlos');

      const finalProfile = await NJCAACoachProfile.findOne({
        where: { userId: finalUser.id }
      });
      expect(finalProfile).toBeDefined();
      expect(finalProfile.totalEvaluations).toBe(3);
      expect(finalProfile.position).toBe('assistant_coach'); // Mise à jour appliquée

      // Vérifier que les évaluations existent
      const evaluationCount = await require('../../models').PlayerEvaluation.count({
        where: { njcaaCoachProfileId: finalProfile.id }
      });
      expect(evaluationCount).toBe(3);

      console.log('✅ All data persisted correctly in database');
      console.log('🎊 NJCAA Coach User Journey completed successfully!');
      console.log('');
      console.log('📋 Journey Summary:');
      console.log('  ✓ Registration with complete profile');
      console.log('  ✓ Authentication and dashboard access');
      console.log('  ✓ Team player discovery and management');
      console.log('  ✓ Player evaluations with detailed feedback');
      console.log('  ✓ Analytics and performance tracking');
      console.log('  ✓ Profile updates and preferences');
      console.log('  ✓ Session management and token refresh');
      console.log('  ✓ Secure logout and cleanup');
      console.log('  ✓ Data persistence validation');
      console.log('');
      console.log('🚀 Phase 5B NJCAA Coach workflow fully validated!');
    });
  });

  describe('🔄 Alternative User Scenarios', () => {
    test('👩‍💼 Women\'s soccer coach workflow', async () => {
      console.log('👩‍💼 Testing women\'s soccer coach workflow...');

      // Créer un coach d'équipe féminine
      const femaleCoachData = await TestHelpers.createTestNJCAACoach({
        college: testCollege,
        user: {
          email: 'coach.williams@riverside.edu',
          firstName: 'Sarah',
          lastName: 'Williams'
        },
        profile: {
          position: 'head_coach',
          teamSport: 'womens_soccer'
        }
      });

      const coachToken = femaleCoachData.getAuthToken();

      // Créer des joueuses
      const femalePlayers = await Promise.all([
        TestHelpers.createTestPlayer({
          college: testCollege,
          profile: {
            gender: 'female',
            position: 'midfielder',
            isProfileVisible: true
          }
        }),
        TestHelpers.createTestPlayer({
          college: testCollege,
          profile: {
            gender: 'female',
            position: 'forward',
            isProfileVisible: true
          }
        })
      ]);

      // Vérifier que le coach voit seulement les joueuses
      const playersResponse = await request(app)
        .get('/api/njcaa-coaches/my-players')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(playersResponse.body.data.players).toHaveLength(2);
      expect(playersResponse.body.data.players.every(p => p.gender === 'female')).toBe(true);

      console.log('✅ Women\'s soccer coach workflow validated');
    });

    test('🔄 Assistant coach workflow', async () => {
      console.log('🔄 Testing assistant coach workflow...');

      const assistantCoachData = await TestHelpers.createTestNJCAACoach({
        college: testCollege,
        profile: {
          position: 'assistant_coach',
          teamSport: 'mens_soccer'
        }
      });

      const assistantToken = assistantCoachData.getAuthToken();

      // Créer un joueur à évaluer
      const playerData = await TestHelpers.createTestPlayer({
        college: testCollege,
        profile: {
          gender: 'male',
          position: 'defender',
          isProfileVisible: true
        }
      });

      // L'assistant coach devrait pouvoir évaluer comme un head coach
      const evaluationResponse = await request(app)
        .post('/api/njcaa-coaches/evaluate-player')
        .set('Authorization', `Bearer ${assistantToken}`)
        .send({
          playerId: playerData.profile.id,
          rating: 4,
          notes: 'Assistant coach evaluation - solid defensive work'
        })
        .expect(201);

      TestHelpers.expectSuccessResponse(evaluationResponse, 201);

      console.log('✅ Assistant coach workflow validated');
    });

    test('🚫 Error handling and edge cases', async () => {
      console.log('🚫 Testing error scenarios...');

      const coachData = await TestHelpers.createTestNJCAACoach({
        college: testCollege
      });
      const coachToken = coachData.getAuthToken();

      // Tenter d'évaluer un joueur inexistant
      const invalidEvaluationResponse = await request(app)
        .post('/api/njcaa-coaches/evaluate-player')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          playerId: 99999, // ID inexistant
          rating: 4,
          notes: 'This should fail'
        })
        .expect(404);

      TestHelpers.expectErrorResponse(invalidEvaluationResponse, 404);

      // Tenter d'accéder au dashboard avec un token invalide
      const invalidTokenResponse = await request(app)
        .get('/api/njcaa-coaches/dashboard')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      TestHelpers.expectErrorResponse(invalidTokenResponse, 401);

      console.log('✅ Error scenarios handled correctly');
    });
  });

  describe('📊 Performance Under Real Usage', () => {
    test('⚡ High-volume evaluation scenario', async () => {
      console.log('⚡ Testing high-volume usage...');

      const coachData = await TestHelpers.createTestNJCAACoach({
        college: testCollege
      });
      const coachToken = coachData.getAuthToken();

      // Créer une grande équipe (30 joueurs)
      const largePlayers = await Promise.all(Array(30).fill().map((_, i) =>
        TestHelpers.createTestPlayer({
          college: testCollege,
          user: {
            firstName: `Player${i}`,
            lastName: 'TestName'
          },
          profile: {
            gender: 'male',
            position: ['midfielder', 'forward', 'defender', 'goalkeeper'][i % 4],
            isProfileVisible: true
          }
        })
      ));

      const startTime = Date.now();

      // Évaluer les 10 premiers joueurs rapidement
      const evaluationPromises = largePlayers.slice(0, 10).map((playerData, i) =>
        request(app)
          .post('/api/njcaa-coaches/evaluate-player')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            playerId: playerData.profile.id,
            rating: 3 + (i % 3),
            notes: `Bulk evaluation ${i + 1}`
          })
      );

      const results = await Promise.all(evaluationPromises);
      const endTime = Date.now();

      expect(results.every(r => r.status === 201)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Moins de 5 secondes

      console.log(`✅ Evaluated 10 players in ${endTime - startTime}ms`);
    });
  });
});