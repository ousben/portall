// server/tests/integration/api/njcaaCoachRoutes.test.js

process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../../server');
const models = require('../../../models');
const { User, NJCAACoachProfile, NJCAACollege, PlayerProfile, PlayerEvaluation } = models;
const { sequelize } = models;
const AuthService = require('../../../services/authService');

describe('🏟️ NJCAA Coach Routes Integration Tests', () => {
  let testNJCAACoach;
  let testNJCAACollege;
  let testMalePlayer;
  let testFemalePlayer;
  let authToken;

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

      expect(response.status).toBe(200);
      
      // ✅ CORRECTION : Vérifier que la propriété players existe d'abord
      expect(response.body.data).toHaveProperty('players');
      const players = response.body.data.players;

      expect(players).toHaveLength(1);
      expect(players[0].profile.gender).toBe('male');
    });
  });

  describe('🎯 Player Evaluation System', () => {
    test('Should create new player evaluation successfully', async () => {
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
        coachabilityComment: 'Very coachable player with great attitude',
        technique: 'Strong technical skills, needs work on weak foot',
        physique: 'Good physical condition, could improve strength',
        coachFinalComment: 'Excellent potential player with room for growth'
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
        expectedGraduationDate: 2025,
        coachabilityComment: 'Very coachable player with great attitude',
        technique: 'Strong technical skills, needs work on weak foot',
        physique: 'Good physical condition, could improve strength',
        coachFinalComment: 'Excellent potential player with room for growth'
      };

      const response = await request(app)
        .post(`/api/njcaa-coaches/players/${testFemalePlayer.id}/evaluation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationData);

      expect(response.status).toBe(403);
      // ✅ CORRECTION : Attendre le bon code d'erreur
      expect(response.body.code).toBe('EVALUATION_ACCESS_DENIED');
    });
  });

  afterAll(async () => {
    // Nettoyer les données de test
    if (testNJCAACoach) await NJCAACoachProfile.destroy({ where: { id: testNJCAACoach.id } });
    if (testNJCAACollege) await NJCAACollege.destroy({ where: { id: testNJCAACollege.id } });
    if (testMalePlayer) await PlayerProfile.destroy({ where: { id: testMalePlayer.id } });
    if (testFemalePlayer) await PlayerProfile.destroy({ where: { id: testFemalePlayer.id } });
    
    // Nettoyer les utilisateurs
    await User.destroy({ where: { email: { [require('sequelize').Op.like]: '%@testcollege.edu' } } });
    
    // Nettoyer les évaluations
    await PlayerEvaluation.destroy({ where: { njcaaCoachProfileId: testNJCAACoach?.id } });
  });
});