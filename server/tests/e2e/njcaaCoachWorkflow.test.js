// server/tests/e2e/njcaaCoachWorkflow.test.js

const request = require('supertest');
const app = require('../../server');
const { sequelize } = require('../../config/database.connection');

/**
 * 🎭 Tests End-to-End : Workflow complet d'un coach NJCAA
 * 
 * Ces tests simulent le parcours complet d'un coach NJCAA :
 * 1. Inscription sur la plateforme
 * 2. Connexion
 * 3. Accès au dashboard
 * 4. Évaluation d'un joueur
 * 5. Gestion des settings
 * 
 * 🎯 Objectif : Garantir que tout le flow fonctionne de bout en bout
 */

describe('🎭 NJCAA Coach Complete Workflow E2E', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
    // Créer les données de référence nécessaires
    await sequelize.models.NJCAACollege.create({
      name: 'Workflow Test College',
      state: 'FL',
      region: 'Southeast',
      isActive: true
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('🚀 Complete NJCAA Coach Journey', async () => {
    // 📝 ÉTAPE 1 : Inscription
    console.log('🔍 Testing registration...');
    
    const registrationData = {
      email: 'workflow.coach@testcollege.edu',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      firstName: 'Workflow',
      lastName: 'Coach',
      userType: 'njcaa_coach',
      position: 'head_coach',
      phoneNumber: '+1555000123',
      collegeId: 1, // ID du college créé
      division: 'njcaa_d1',
      teamSport: 'womens_soccer'
    };

    const registrationResponse = await request(app)
      .post('/api/auth/register')
      .send(registrationData);

    expect(registrationResponse.status).toBe(201);
    expect(registrationResponse.body.data.user.userType).toBe('njcaa_coach');
    
    // Activer manuellement le compte pour les tests
    const userId = registrationResponse.body.data.user.id;
    await sequelize.models.User.update(
      { isActive: true },
      { where: { id: userId } }
    );

    // 🔐 ÉTAPE 2 : Connexion
    console.log('🔍 Testing login...');
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'workflow.coach@testcollege.edu',
        password: 'SecurePass123!'
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.tokens.accessToken).toBeDefined();
    
    const authToken = loginResponse.body.data.tokens.accessToken;

    // 📊 ÉTAPE 3 : Accès au dashboard
    console.log('🔍 Testing dashboard access...');
    
    const dashboardResponse = await request(app)
      .get('/api/njcaa-coaches/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.data.coach.profile.teamSport).toBe('womens_soccer');

    // 👤 ÉTAPE 4 : Créer un joueur compatible et l'évaluer
    console.log('🔍 Testing player evaluation...');
    
    // Créer un joueur féminin compatible
    const playerUser = await sequelize.models.User.create({
      email: 'compatible.player@testcollege.edu',
      password: 'PlayerPass123!',
      firstName: 'Compatible',
      lastName: 'Player',
      userType: 'player',
      isActive: true
    });

    const playerProfile = await sequelize.models.PlayerProfile.create({
      userId: playerUser.id,
      dateOfBirth: new Date('2003-05-15'),
      height: 170,
      weight: 65,
      position: 'midfielder',
      gender: 'female', // Compatible avec womens_soccer
      collegeId: 1,
      currentYear: 'sophomore',
      graduationYear: 2025,
      isProfileVisible: true
    });

    // Évaluer le joueur
    const evaluationData = {
      availableToTransfer: true,
      roleInTeam: 'Key player and team captain',
      expectedGraduationDate: '2025',
      performanceLevel: 'Division I potential',
      playerStrengths: 'Leadership, technical skills, game intelligence',
      areasForImprovement: 'Physical strength and aerial ability',
      mentality: 'Excellent leadership qualities and competitive spirit',
      coachability: 'Outstanding, very receptive to feedback',
      technique: 'Excellent first touch and passing accuracy',
      physique: 'Good endurance, needs strength development',
      coachFinalComment: 'This player has exceptional potential and would be a valuable addition to any Division I program. Strong character and work ethic.'
    };

    const evaluationResponse = await request(app)
      .post(`/api/njcaa-coaches/players/${playerProfile.id}/evaluation`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(evaluationData);

    expect(evaluationResponse.status).toBe(201);
    expect(evaluationResponse.body.data.evaluation.availableToTransfer).toBe(true);

    // ⚙️ ÉTAPE 5 : Gestion des settings
    console.log('🔍 Testing settings management...');
    
    const settingsResponse = await request(app)
      .get('/api/njcaa-coaches/settings')
      .set('Authorization', `Bearer ${authToken}`);

    expect(settingsResponse.status).toBe(200);
    expect(settingsResponse.body.data.profile.position).toBe('head_coach');

    // Mise à jour des settings
    const updateResponse = await request(app)
      .put('/api/njcaa-coaches/settings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ phoneNumber: '+1555999888' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.profile.phoneNumber).toBe('+1555999888');

    // 📈 ÉTAPE 6 : Vérifier l'historique des évaluations
    console.log('🔍 Testing evaluation history...');
    
    const historyResponse = await request(app)
      .get('/api/njcaa-coaches/evaluation-history')
      .set('Authorization', `Bearer ${authToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.totalEvaluations).toBe(1);
    expect(historyResponse.body.data.uniquePlayers).toBe(1);

    console.log('✅ Complete workflow test passed successfully!');
  });
});