// server/tests/integration/api/njcaaCoachRoutes.test.js

process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../../server');
const models = require('../../../models');
const { User, NJCAACoachProfile, NJCAACollege, PlayerProfile, PlayerEvaluation } = models;
const { sequelize } = models;
const AuthService = require('../../../services/authService');

/**
 * 🧪 Tests d'intégration pour les routes des coachs NJCAA
 * 
 * Ces tests vérifient que votre API fonctionne correctement dans des conditions
 * réalistes, en testant l'intégration entre vos routes, contrôleurs, middleware
 * d'authentification, et base de données.
 * 
 * 🎯 Ce que nous testons :
 * - Authentification et autorisation des endpoints
 * - Logique métier de filtrage des joueurs
 * - Système d'évaluation complet
 * - Gestion des erreurs et cas limites
 * - Sécurité des accès
 */

describe('🏟️ NJCAA Coach Routes Integration Tests', () => {
  let testNJCAACoach;
  let testNJCAACollege;
  let testMalePlayer;
  let testFemalePlayer;
  let authToken;

  // Configuration avant tous les tests
  beforeAll(async () => {
    // Créer un college NJCAA de test
    testNJCAACollege = await NJCAACollege.create({
      name: 'Test Community College',
      state: 'CA',
      region: 'West',
      isActive: true
    });

    // Créer un coach NJCAA de test (équipe masculine)
    const coachUser = await User.create({
      email: 'coach.test@testcollege.edu',
      password: 'TestPass123!',
      firstName: 'John',
      lastName: 'Coach',
      userType: 'njcaa_coach',
      isActive: true,
      isEmailVerified: true
    });

    testNJCAACoach = await NJCAACoachProfile.create({
      userId: coachUser.id,
      position: 'head_coach',
      phoneNumber: '+1234567890',
      collegeId: testNJCAACollege.id,
      division: 'njcaa_d1',
      teamSport: 'mens_soccer'
    });

    // Créer un joueur masculin (même college)
    const malePlayerUser = await User.create({
      email: 'player.male@testcollege.edu',
      password: 'TestPass123!',
      firstName: 'Mike',
      lastName: 'Player',
      userType: 'player',
      isActive: true
    });

    testMalePlayer = await PlayerProfile.create({
      userId: malePlayerUser.id,
      dateOfBirth: new Date('2002-01-15'),
      height: 180,
      weight: 75,
      position: 'midfielder',
      gender: 'male',
      collegeId: testNJCAACollege.id,
      currentYear: 'freshman',
      graduationYear: 2026,
      isProfileVisible: true
    });

    // Créer un joueur féminin (même college, genre différent)
    const femalePlayerUser = await User.create({
      email: 'player.female@testcollege.edu',
      password: 'TestPass123!',
      firstName: 'Sarah',
      lastName: 'Player',
      userType: 'player',
      isActive: true
    });

    testFemalePlayer = await PlayerProfile.create({
      userId: femalePlayerUser.id,
      dateOfBirth: new Date('2003-03-20'),
      height: 165,
      weight: 60,
      position: 'forward',
      gender: 'female',
      collegeId: testNJCAACollege.id,
      currentYear: 'sophomore',
      graduationYear: 2025,
      isProfileVisible: true
    });

    // Générer un token d'authentification
    authToken = AuthService.generateTokenPair(coachUser).accessToken;
  });

  describe('🔐 Authentication & Authorization', () => {
    test('Should require authentication for dashboard access', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/dashboard');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });

    test('Should allow authenticated NJCAA coach access', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });
  });

  describe('📊 Dashboard Functionality', () => {
    test('Should return complete dashboard data structure', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('coach');
      expect(response.body.data).toHaveProperty('players');
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data).toHaveProperty('metadata');
    });

    test('Should filter players by same college and gender', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      const players = response.body.data.players;
      
      // Le coach masculin ne devrait voir que le joueur masculin
      expect(players).toHaveLength(1);
      expect(players[0].gender).toBe('male');
      expect(players[0].collegeId).toBe(testNJCAACollege.id);
    });
  });

  describe('📝 Player Evaluation System', () => {
    test('Should create new player evaluation successfully', async () => {
      const evaluationData = {
        availableToTransfer: true,
        roleInTeam: 'Starting midfielder',
        expectedGraduationDate: '2026',
        performanceLevel: 'Division II ready',
        playerStrengths: 'Excellent ball control and vision',
        areasForImprovement: 'Defensive positioning',
        mentality: 'Very competitive and focused',
        coachability: 'Excellent, always listens and applies feedback',
        technique: 'Above average first touch and passing',
        physique: 'Good pace and endurance',
        coachFinalComment: 'Promising player with great potential'
      };

      const response = await request(app)
        .post(`/api/njcaa-coaches/players/${testMalePlayer.id}/evaluation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.evaluation).toHaveProperty('availableToTransfer', true);
    });

    test('Should prevent evaluation of wrong gender players', async () => {
      const evaluationData = {
        availableToTransfer: true,
        roleInTeam: 'Test',
        expectedGraduationDate: '2025',
        performanceLevel: 'Test',
        playerStrengths: 'Test',
        areasForImprovement: 'Test',
        mentality: 'Test',
        coachability: 'Test',
        technique: 'Test',
        physique: 'Test',
        coachFinalComment: 'Test'
      };

      const response = await request(app)
        .post(`/api/njcaa-coaches/players/${testFemalePlayer.id}/evaluation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationData);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('EVALUATION_ACCESS_DENIED');
    });
  });
});