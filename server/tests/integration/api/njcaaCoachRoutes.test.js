// server/tests/integration/api/njcaaCoachRoutes.test.js

const request = require('supertest');
const app = require('../../../server');
const { User, PlayerProfile, NJCAACoachProfile, NJCAACollege, PlayerEvaluation } = require('../../../models');
const { sequelize } = require('../../../config/database.connection');
const AuthService = require('../../../services/authService');

/**
 * 🧪 Suite de tests complète pour les routes des coachs NJCAA
 * 
 * Cette suite teste l'intégration complète du workflow coach NJCAA
 * depuis l'inscription jusqu'aux évaluations de joueurs.
 * 
 * 🎓 Concepts testés :
 * - Authentification et autorisation
 * - Logique métier de filtrage (même college + même genre)
 * - Validation des données d'évaluation
 * - Gestion des erreurs et edge cases
 * - Sécurité des accès
 */

describe('🏟️ NJCAA Coach Routes Integration Tests', () => {
  let testNJCAACoach;
  let testNJCAACollege;
  let testMalePlayer;
  let testFemalePlayer;
  let authToken;

  // 🔧 Configuration avant tous les tests
  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
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

  // 🧹 Nettoyage après tous les tests
  afterAll(async () => {
    await sequelize.close();
  });

  describe('🔐 Authentication & Authorization', () => {
    test('Should require authentication for dashboard access', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/dashboard');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('AUTH_REQUIRED');
    });

    test('Should reject non-NJCAA coach users', async () => {
      // Créer un utilisateur player pour tester l'autorisation
      const playerUser = await User.create({
        email: 'unauthorized@test.com',
        password: 'TestPass123!',
        firstName: 'Unauthorized',
        lastName: 'User',
        userType: 'player',
        isActive: true
      });

      const playerToken = AuthService.generateTokenPair(playerUser).accessToken;

      const response = await request(app)
        .get('/api/njcaa-coaches/dashboard')
        .set('Authorization', `Bearer ${playerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('NJCAA_COACH_ACCESS_REQUIRED');
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

    test('Should include evaluation status for each player', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      const players = response.body.data.players;
      
      expect(players[0]).toHaveProperty('evaluationStatus');
      expect(players[0].evaluationStatus).toHaveProperty('hasEvaluation');
      expect(players[0].evaluationStatus).toHaveProperty('lastEvaluated');
      expect(players[0].evaluationStatus).toHaveProperty('availableToTransfer');
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
      expect(response.body.data.evaluation).toHaveProperty('evaluationVersion', 1);
      expect(response.body.data.evaluation).toHaveProperty('isCurrent', true);
    });

    test('Should update existing evaluation with versioning', async () => {
      // D'abord créer une évaluation initiale
      const initialEvaluation = {
        availableToTransfer: false,
        roleInTeam: 'Substitute',
        expectedGraduationDate: '2026',
        performanceLevel: 'Developing',
        playerStrengths: 'Good attitude',
        areasForImprovement: 'Technical skills',
        mentality: 'Positive',
        coachability: 'Good',
        technique: 'Developing',
        physique: 'Average',
        coachFinalComment: 'Shows promise'
      };

      await request(app)
        .post(`/api/njcaa-coaches/players/${testMalePlayer.id}/evaluation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(initialEvaluation);

      // Maintenant mettre à jour l'évaluation
      const updatedEvaluation = {
        availableToTransfer: true,
        roleInTeam: 'Starting player',
        expectedGraduationDate: '2026',
        performanceLevel: 'Division I ready',
        playerStrengths: 'Exceptional leadership and technique',
        areasForImprovement: 'Physical conditioning',
        mentality: 'Outstanding work ethic',
        coachability: 'Exceptional',
        technique: 'Very strong',
        physique: 'Improving rapidly',
        coachFinalComment: 'Ready for next level'
      };

      const response = await request(app)
        .post(`/api/njcaa-coaches/players/${testMalePlayer.id}/evaluation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedEvaluation);

      expect(response.status).toBe(201);
      expect(response.body.data.evaluation).toHaveProperty('evaluationVersion', 2);
      expect(response.body.data.evaluation).toHaveProperty('isCurrent', true);
      expect(response.body.data.metadata.isUpdate).toBe(true);
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

    test('Should validate evaluation data thoroughly', async () => {
      const invalidEvaluationData = {
        availableToTransfer: 'not_a_boolean', // Type incorrect
        roleInTeam: '', // Champ vide
        expectedGraduationDate: 'invalid_year', // Format incorrect
        // Champs obligatoires manquants
      };

      const response = await request(app)
        .post(`/api/njcaa-coaches/players/${testMalePlayer.id}/evaluation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidEvaluationData);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('EVALUATION_VALIDATION_ERROR');
      expect(response.body.errors).toBeDefined();
    });

    test('Should retrieve existing player evaluation', async () => {
      // D'abord créer une évaluation
      const evaluationData = {
        availableToTransfer: true,
        roleInTeam: 'Starting midfielder',
        expectedGraduationDate: '2026',
        performanceLevel: 'Division II ready',
        playerStrengths: 'Excellent ball control',
        areasForImprovement: 'Defensive positioning',
        mentality: 'Competitive',
        coachability: 'Excellent',
        technique: 'Above average',
        physique: 'Good pace',
        coachFinalComment: 'Promising player'
      };

      await request(app)
        .post(`/api/njcaa-coaches/players/${testMalePlayer.id}/evaluation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationData);

      // Maintenant récupérer l'évaluation
      const response = await request(app)
        .get(`/api/njcaa-coaches/players/${testMalePlayer.id}/evaluation`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.evaluation).toHaveProperty('availableToTransfer', true);
      expect(response.body.data.evaluation).toHaveProperty('roleInTeam', 'Starting midfielder');
    });
  });

  describe('⚙️ Settings Management', () => {
    test('Should return settings page data', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/settings')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('profile');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('college');
      expect(response.body.data).toHaveProperty('editableFields');
    });

    test('Should update allowed profile fields', async () => {
      const updateData = {
        phoneNumber: '+1987654321'
      };

      const response = await request(app)
        .put('/api/njcaa-coaches/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.profile.phoneNumber).toBe('+1987654321');
      expect(response.body.data.updatedFields).toContain('phoneNumber');
    });

    test('Should reject updates to restricted fields', async () => {
      const restrictedUpdateData = {
        position: 'assistant_coach', // Champ non modifiable
        division: 'njcaa_d2', // Champ non modifiable
        collegeId: 999 // Champ non modifiable
      };

      const response = await request(app)
        .put('/api/njcaa-coaches/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(restrictedUpdateData);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('NO_VALID_FIELDS');
    });
  });

  describe('📈 Evaluation History', () => {
    test('Should return evaluation history', async () => {
      const response = await request(app)
        .get('/api/njcaa-coaches/evaluation-history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('totalEvaluations');
      expect(response.body.data).toHaveProperty('uniquePlayers');
      expect(response.body.data).toHaveProperty('evaluationsByPlayer');
      expect(response.body.data).toHaveProperty('summary');
    });
  });
});