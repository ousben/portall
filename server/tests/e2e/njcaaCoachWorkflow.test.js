// server/tests/e2e/njcaaCoachWorkflow.test.js

process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../server');
const models = require('../../models');
const { User, NJCAACoachProfile, NJCAACollege, PlayerProfile, PlayerEvaluation } = models;
const { sequelize } = models;

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
 * 
 * CONCEPT PÉDAGOGIQUE : Les tests E2E simulent l'expérience réelle d'un utilisateur
 * en testant l'intégration complète de tous les composants système.
 */

describe('🎭 NJCAA Coach Complete Workflow E2E', () => {
  let testCollege;
  let testCoachUser;
  let authToken;

  beforeAll(async () => {
    // Configuration de l'environnement de test
    console.log('🔧 Setting up E2E test environment...');
    
    // Synchroniser la base de données de test
    await sequelize.sync({ force: true });
    
    // Créer le college de référence nécessaire pour les tests
    testCollege = await NJCAACollege.create({
      name: 'Workflow Test College',
      state: 'FL',
      region: 'Southeast',
      isActive: true
    });
    
    console.log(`✅ Test college created with ID: ${testCollege.id}`);
  });

  afterAll(async () => {
    // Nettoyage complet après tous les tests
    console.log('🧹 Cleaning up E2E test environment...');
    await sequelize.close();
  });

  test('🚀 Complete NJCAA Coach Journey', async () => {
    console.log('🎬 Starting complete NJCAA coach workflow test...');

    // 📝 ÉTAPE 1 : Inscription directe (sans passer par /api/auth/register)
    // STRATÉGIE : Créer directement les entités pour simplifier le test E2E
    console.log('🔍 Step 1: Creating coach user and profile...');
    
    // Créer l'utilisateur coach directement
    testCoachUser = await User.create({
      email: 'workflow.coach@testcollege.edu',
      password: 'SecurePass123!',
      firstName: 'Workflow',
      lastName: 'Coach',
      userType: 'njcaa_coach',
      isActive: true,
      isEmailVerified: true
    });

    // Créer le profil coach NJCAA
    const coachProfile = await NJCAACoachProfile.create({
      userId: testCoachUser.id,
      position: 'head_coach',
      phoneNumber: '+1555000123',
      collegeId: testCollege.id,
      division: 'njcaa_d1',
      teamSport: 'womens_soccer'
    });

    console.log(`✅ Coach user created (ID: ${testCoachUser.id})`);
    console.log(`✅ Coach profile created (ID: ${coachProfile.id})`);

    // 🔐 ÉTAPE 2 : Connexion
    console.log('🔍 Step 2: Testing login...');
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'workflow.coach@testcollege.edu',
        password: 'SecurePass123!'
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user.userType).toBe('njcaa_coach');
    
    authToken = loginResponse.body.data.tokens.accessToken;
    console.log('✅ Login successful, token obtained');

    // 📊 ÉTAPE 3 : Accès au dashboard
    console.log('🔍 Step 3: Testing dashboard access...');
    
    const dashboardResponse = await request(app)
      .get('/api/njcaa-coaches/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.data).toHaveProperty('coach');
    expect(dashboardResponse.body.data).toHaveProperty('players');
    expect(dashboardResponse.body.data).toHaveProperty('statistics');
    console.log('✅ Dashboard access successful');

    // 👤 ÉTAPE 4 : Créer un joueur à évaluer
    console.log('🔍 Step 4: Creating player for evaluation...');
    
    const playerUser = await User.create({
      email: 'test.player@testcollege.edu',
      password: 'PlayerPass123!',
      firstName: 'Test',
      lastName: 'Player',
      userType: 'player',
      isActive: true
    });

    const playerProfile = await PlayerProfile.create({
      userId: playerUser.id,
      dateOfBirth: new Date('2002-05-15'),
      height: 170,
      weight: 65,
      position: 'midfielder',
      gender: 'female', // Correspondant à l'équipe du coach (womens_soccer)
      collegeId: testCollege.id,
      currentYear: 'sophomore',
      graduationYear: 2026,
      isProfileVisible: true
    });

    console.log(`✅ Player created (ID: ${playerProfile.id})`);

    // 📋 ÉTAPE 5 : Évaluation d'un joueur
    console.log('🔍 Step 5: Testing player evaluation...');
    
    const evaluationData = {
      speed: 8,
      agility: 7,
      ballControl: 9,
      passing: 8,
      shooting: 6,
      defending: 7,
      gameIntelligence: 8,
      workEthic: 9,
      physicalFitness: 8,
      leadership: 7,
      overallScore: 8,
      availableToTransfer: true,
      expectedGraduationDate: 2026,
      coachabilityComment: 'Very coachable player with great attitude and dedication.',
      technique: 'Strong technical skills overall, needs work on weak foot finishing.',
      physique: 'Good physical condition, could improve upper body strength.',
      coachFinalComment: 'Excellent potential player with room for growth. Strong character and work ethic make her a valuable team member.'
    };

    const evaluationResponse = await request(app)
      .post(`/api/njcaa-coaches/players/${playerProfile.id}/evaluation`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(evaluationData);

    expect(evaluationResponse.status).toBe(201);
    expect(evaluationResponse.body.status).toBe('success');
    expect(evaluationResponse.body.data.evaluation).toHaveProperty('availableToTransfer', true);
    console.log('✅ Player evaluation successful');

    // ⚙️ ÉTAPE 6 : Gestion des settings
    console.log('🔍 Step 6: Testing settings management...');
    
    const settingsResponse = await request(app)
      .get('/api/njcaa-coaches/settings')
      .set('Authorization', `Bearer ${authToken}`);

    expect(settingsResponse.status).toBe(200);
    expect(settingsResponse.body.data.profile.position).toBe('head_coach');
    console.log('✅ Settings retrieval successful');

    // Mise à jour des settings
    const updateResponse = await request(app)
      .put('/api/njcaa-coaches/settings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ phoneNumber: '+1555999888' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.profile.phoneNumber).toBe('+1555999888');
    console.log('✅ Settings update successful');

    // 📈 ÉTAPE 7 : Vérifier l'historique des évaluations
    console.log('🔍 Step 7: Testing evaluation history...');
    
    const historyResponse = await request(app)
      .get('/api/njcaa-coaches/evaluation-history')
      .set('Authorization', `Bearer ${authToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.pagination.totalEvaluations).toBe(1);
    console.log('✅ Evaluation history successful');

    // 🎯 ÉTAPE 8 : Vérifier le dashboard mis à jour
    console.log('🔍 Step 8: Testing updated dashboard...');
    
    const updatedDashboardResponse = await request(app)
      .get('/api/njcaa-coaches/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(updatedDashboardResponse.status).toBe(200);
    expect(updatedDashboardResponse.body.data.statistics.evaluatedPlayers).toBe(1);
    expect(updatedDashboardResponse.body.data.statistics.totalPlayers).toBe(1);
    console.log('✅ Updated dashboard verification successful');

    console.log('🎉 Complete workflow test passed successfully!');
    console.log('🏁 All E2E test steps completed without errors');
  });
});