// server/tests/unit/models/njcaaCoachProfile.test.js

// Charger l'environnement de test AVANT les imports
process.env.NODE_ENV = 'test';

// Utiliser le système d'import de modèles centralisé pour garantir les associations
const models = require('../../../models');
const { User, NJCAACoachProfile, NJCAACollege, PlayerProfile } = models;
const { sequelize } = models;

/**
 * 🧪 Tests unitaires pour le modèle NJCAACoachProfile
 * 
 * Cette suite de tests vérifie que votre modèle NJCAACoachProfile fonctionne
 * correctement avec toutes ses méthodes personnalisées et validations.
 * 
 * 🎯 Points testés :
 * - Validations des champs et contraintes ENUM
 * - Méthodes d'instance comme incrementEvaluations() et getMyPlayers()
 * - Associations avec User et NJCAACollege
 * - Logique métier de filtrage par genre et college
 * 
 * ⚡ Architecture : Ces tests utilisent votre structure de modèles existante
 * sans aucune modification, garantissant une compatibilité parfaite.
 */

describe('🏟️ NJCAACoachProfile Model Unit Tests', () => {
  let testCollege;
  let testUser;

  // Configuration avant tous les tests de cette suite
  beforeAll(async () => {
    // Vérifier que nous sommes en environnement de test
    expect(process.env.NODE_ENV).toBe('test');
    
    // Créer les données de référence nécessaires
    testCollege = await NJCAACollege.create({
      name: 'Test NJCAA College',
      state: 'TX',
      region: 'South',
      isActive: true
    });

    testUser = await User.create({
      email: 'test.coach@example.com',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'Coach',
      userType: 'njcaa_coach',
      isActive: true
    });
  });

  // Nettoyage après chaque test de cette suite
  afterEach(async () => {
    // Supprimer tous les profils de coach créés pendant les tests
    await NJCAACoachProfile.destroy({ where: {}, force: true });
  });

  describe('✅ Model Validations', () => {
    test('Should create valid NJCAA coach profile', async () => {
      const coachProfile = await NJCAACoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testCollege.id,
        division: 'njcaa_d1',
        teamSport: 'mens_soccer'
      });

      expect(coachProfile.id).toBeDefined();
      expect(coachProfile.position).toBe('head_coach');
      expect(coachProfile.totalEvaluations).toBe(0);
      expect(coachProfile.lastEvaluationDate).toBeNull();
    });

    test('Should validate enum values for position', async () => {
      await expect(NJCAACoachProfile.create({
        userId: testUser.id,
        position: 'invalid_position',
        phoneNumber: '+1234567890',
        collegeId: testCollege.id,
        division: 'njcaa_d1',
        teamSport: 'mens_soccer'
      })).rejects.toThrow();
    });

    test('Should validate enum values for division', async () => {
      await expect(NJCAACoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testCollege.id,
        division: 'invalid_division',
        teamSport: 'mens_soccer'
      })).rejects.toThrow();
    });

    test('Should validate enum values for teamSport', async () => {
      await expect(NJCAACoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testCollege.id,
        division: 'njcaa_d1',
        teamSport: 'invalid_sport'
      })).rejects.toThrow();
    });

    test('Should validate phone number format', async () => {
      await expect(NJCAACoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '123', // Trop court
        collegeId: testCollege.id,
        division: 'njcaa_d1',
        teamSport: 'mens_soccer'
      })).rejects.toThrow();
    });

    test('Should enforce unique userId constraint', async () => {
      // Créer le premier profil
      await NJCAACoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testCollege.id,
        division: 'njcaa_d1',
        teamSport: 'mens_soccer'
      });

      // Tenter de créer un second profil avec le même userId
      await expect(NJCAACoachProfile.create({
        userId: testUser.id, // Même userId
        position: 'assistant_coach',
        phoneNumber: '+0987654321',
        collegeId: testCollege.id,
        division: 'njcaa_d2',
        teamSport: 'womens_soccer'
      })).rejects.toThrow();
    });
  });

  describe('🔧 Instance Methods', () => {
    let coachProfile;

    beforeEach(async () => {
      coachProfile = await NJCAACoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testCollege.id,
        division: 'njcaa_d1',
        teamSport: 'mens_soccer'
      });
    });

    test('Should increment evaluations correctly', async () => {
      const initialCount = coachProfile.totalEvaluations;
      const initialDate = coachProfile.lastEvaluationDate;

      await coachProfile.incrementEvaluations();

      await coachProfile.reload();
      expect(coachProfile.totalEvaluations).toBe(initialCount + 1);
      expect(coachProfile.lastEvaluationDate).not.toBe(initialDate);
      expect(coachProfile.lastEvaluationDate).toBeInstanceOf(Date);
    });

    test('Should get filtered players (same college and gender)', async () => {
      // Créer des utilisateurs pour les joueurs
      const malePlayerUser = await User.create({
        email: 'male.player@test.com',
        password: 'TestPass123!',
        firstName: 'Male',
        lastName: 'Player',
        userType: 'player',
        isActive: true
      });

      const femalePlayerUser = await User.create({
        email: 'female.player@test.com',
        password: 'TestPass123!',
        firstName: 'Female',
        lastName: 'Player',
        userType: 'player',
        isActive: true
      });

      // Créer des profils de joueurs
      await PlayerProfile.create({
        userId: malePlayerUser.id,
        dateOfBirth: new Date('2002-01-01'),
        height: 180,
        weight: 75,
        position: 'midfielder',
        gender: 'male',
        collegeId: testCollege.id,
        currentYear: 'freshman',
        graduationYear: 2026,
        isProfileVisible: true
      });

      await PlayerProfile.create({
        userId: femalePlayerUser.id,
        dateOfBirth: new Date('2002-01-01'),
        height: 165,
        weight: 60,
        position: 'forward',
        gender: 'female',
        collegeId: testCollege.id,
        currentYear: 'freshman',
        graduationYear: 2026,
        isProfileVisible: true
      });

      const myPlayers = await coachProfile.getMyPlayers();
      
      // Coach avec mens_soccer ne devrait voir que les joueurs masculins
      expect(myPlayers).toHaveLength(1);
      expect(myPlayers[0].gender).toBe('male');
      expect(myPlayers[0].collegeId).toBe(testCollege.id);
    });

    test('Should return complete public JSON', () => {
      const publicData = coachProfile.toPublicJSON();
      
      expect(publicData).toHaveProperty('position');
      expect(publicData).toHaveProperty('teamSport');
      expect(publicData).toHaveProperty('division');
      expect(publicData).toHaveProperty('collegeId');
      expect(publicData).toHaveProperty('totalEvaluations');
      expect(publicData).toHaveProperty('phoneNumber'); // Disponible car pas sensible pour NJCAA coaches
    });

    test('Should handle multiple incrementEvaluations calls correctly', async () => {
      const initialCount = coachProfile.totalEvaluations;

      // Incrémenter plusieurs fois
      await coachProfile.incrementEvaluations();
      await coachProfile.incrementEvaluations();
      await coachProfile.incrementEvaluations();

      await coachProfile.reload();
      expect(coachProfile.totalEvaluations).toBe(initialCount + 3);
    });
  });

  describe('🔗 Model Associations', () => {
    let coachProfile;

    beforeEach(async () => {
      coachProfile = await NJCAACoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testCollege.id,
        division: 'njcaa_d1',
        teamSport: 'mens_soccer'
      });
    });

    test('Should have association with User', async () => {
      const profileWithUser = await NJCAACoachProfile.findByPk(coachProfile.id, {
        include: [{ model: User, as: 'user' }]
      });

      expect(profileWithUser.user).toBeDefined();
      expect(profileWithUser.user.email).toBe('test.coach@example.com');
      expect(profileWithUser.user.userType).toBe('njcaa_coach');
    });

    test('Should have association with NJCAACollege', async () => {
      const profileWithCollege = await NJCAACoachProfile.findByPk(coachProfile.id, {
        include: [{ model: NJCAACollege, as: 'college' }]
      });

      expect(profileWithCollege.college).toBeDefined();
      expect(profileWithCollege.college.name).toBe('Test NJCAA College');
      expect(profileWithCollege.college.state).toBe('TX');
    });
  });
});