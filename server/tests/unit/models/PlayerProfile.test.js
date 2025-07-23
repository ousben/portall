// portall/server/tests/unit/models/PlayerProfile.test.js

process.env.NODE_ENV = 'test';

const { User, PlayerProfile, NJCAACollege } = require('../../../models');
const TestHelpers = require('../../utils/testHelpers');

/**
 * 🏃‍♂️ Tests unitaires du modèle PlayerProfile - Cœur métier des joueurs NJCAA
 * 
 * Le modèle PlayerProfile contient toute la logique métier spécifique aux joueurs.
 * Ces tests vérifient que les règles de validation, les associations et les méthodes
 * personnalisées fonctionnent correctement dans tous les cas de figure.
 * 
 * 🎯 Concept pédagogique : "Domain Model Testing"
 * Un modèle de domaine encapsule les règles métier de votre application.
 * Tester ces règles garantit que votre logique business reste cohérente
 * même quand le code évolue. C'est comme vérifier que les règles du football
 * sont respectées sur le terrain - sans cela, le jeu n'a plus de sens.
 * 
 * 💡 Architecture testée :
 * - Validations métier (âge, dimensions physiques, GPA)
 * - Associations avec User et NJCAACollege
 * - Méthodes de calcul (âge, statut éligibilité)
 * - Sérialisation publique/privée des données
 */

describe('🏃‍♂️ PlayerProfile Model - Phase 5A Core Business Logic', () => {
  let testCollege;
  let testUser;

  beforeAll(async () => {
    // Créer les données de référence nécessaires pour tous les tests
    testCollege = await TestHelpers.createTestNJCAACollege();
    testUser = await User.create({
      email: 'player.model.test@example.com',
      password: 'TestPassword123!',
      firstName: 'Model',
      lastName: 'Tester',
      userType: 'player',
      isActive: true
    });
  });

  beforeEach(async () => {
    // Nettoyer seulement les profils entre chaque test
    await PlayerProfile.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('✅ Business Logic Validations', () => {
    test('Should create valid player profile with all required fields', async () => {
      const profileData = {
        userId: testUser.id,
        dateOfBirth: new Date('2003-05-15'),
        height: 175,
        weight: 70,
        position: 'midfielder',
        gender: 'male',
        collegeId: testCollege.id,
        currentYear: 'sophomore',
        graduationYear: 2025,
        gpa: 3.2,
        isProfileVisible: true
      };

      const profile = await PlayerProfile.create(profileData);

      expect(profile.id).toBeDefined();
      expect(profile.userId).toBe(testUser.id);
      expect(profile.position).toBe('midfielder');
      expect(profile.gender).toBe('male');
      expect(profile.gpa).toBe(3.2);
      expect(profile.isProfileVisible).toBe(true);
      expect(profile.createdAt).toBeInstanceOf(Date);
    });

    test('Should validate age constraints for NJCAA eligibility', async () => {
      // Test avec un joueur trop jeune (moins de 16 ans)
      const tooYoung = new Date();
      tooYoung.setFullYear(tooYoung.getFullYear() - 15);

      await expect(PlayerProfile.create({
        userId: testUser.id,
        dateOfBirth: tooYoung,
        height: 175,
        weight: 70,
        position: 'midfielder',
        gender: 'male',
        collegeId: testCollege.id,
        currentYear: 'freshman',
        graduationYear: 2026
      })).rejects.toThrow();

      // Test avec un joueur trop âgé (plus de 30 ans)
      const tooOld = new Date();
      tooOld.setFullYear(tooOld.getFullYear() - 31);

      await expect(PlayerProfile.create({
        userId: testUser.id,
        dateOfBirth: tooOld,
        height: 175,
        weight: 70,
        position: 'midfielder',
        gender: 'male',
        collegeId: testCollege.id,
        currentYear: 'freshman',
        graduationYear: 2026
      })).rejects.toThrow();
    });

    test('Should validate physical dimensions within realistic ranges', async () => {
      const validProfile = {
        userId: testUser.id,
        dateOfBirth: new Date('2003-01-01'),
        gender: 'male',
        position: 'midfielder',
        collegeId: testCollege.id,
        currentYear: 'freshman',
        graduationYear: 2026
      };

      // Test avec une taille irréaliste (trop petite)
      await expect(PlayerProfile.create({
        ...validProfile,
        height: 140, // Trop petit pour un joueur
        weight: 70
      })).rejects.toThrow();

      // Test avec une taille irréaliste (trop grande)
      await expect(PlayerProfile.create({
        ...validProfile,
        height: 230, // Trop grand
        weight: 70
      })).rejects.toThrow();

      // Test avec un poids irréaliste (trop léger)
      await expect(PlayerProfile.create({
        ...validProfile,
        height: 175,
        weight: 40 // Trop léger
      })).rejects.toThrow();

      // Test avec un poids irréaliste (trop lourd)
      await expect(PlayerProfile.create({
        ...validProfile,
        height: 175,
        weight: 160 // Trop lourd pour un joueur de soccer
      })).rejects.toThrow();
    });

    test('Should validate GPA within academic range', async () => {
      const validProfile = {
        userId: testUser.id,
        dateOfBirth: new Date('2003-01-01'),
        height: 175,
        weight: 70,
        gender: 'male',
        position: 'midfielder',
        collegeId: testCollege.id,
        currentYear: 'freshman',
        graduationYear: 2026
      };

      // Test avec un GPA invalide (négatif)
      await expect(PlayerProfile.create({
        ...validProfile,
        gpa: -0.5
      })).rejects.toThrow();

      // Test avec un GPA invalide (trop élevé)
      await expect(PlayerProfile.create({
        ...validProfile,
        gpa: 4.5 // Maximum est 4.0 aux États-Unis
      })).rejects.toThrow();

      // Test avec un GPA valide à la limite
      const profileWithValidGPA = await PlayerProfile.create({
        ...validProfile,
        gpa: 4.0
      });
      expect(profileWithValidGPA.gpa).toBe(4.0);
    });

    test('Should validate enum values for position and gender', async () => {
      const validPositions = ['goalkeeper', 'defender', 'midfielder', 'forward'];
      const invalidPositions = ['invalid_position', 'striker', 'center', 'winger'];

      // Tester les positions valides
      for (const position of validPositions) {
        const profile = await PlayerProfile.create({
          userId: testUser.id,
          dateOfBirth: new Date('2003-01-01'),
          height: 175,
          weight: 70,
          position,
          gender: 'male',
          collegeId: testCollege.id,
          currentYear: 'freshman',
          graduationYear: 2026
        });
        expect(profile.position).toBe(position);
        
        // Nettoyer pour le test suivant
        await profile.destroy();
      }

      // Tester les positions invalides
      for (const position of invalidPositions) {
        await expect(PlayerProfile.create({
          userId: testUser.id,
          dateOfBirth: new Date('2003-01-01'),
          height: 175,
          weight: 70,
          position,
          gender: 'male',
          collegeId: testCollege.id,
          currentYear: 'freshman',
          graduationYear: 2026
        })).rejects.toThrow();
      }

      // Tester les genres invalides
      await expect(PlayerProfile.create({
        userId: testUser.id,
        dateOfBirth: new Date('2003-01-01'),
        height: 175,
        weight: 70,
        position: 'midfielder',
        gender: 'invalid_gender',
        collegeId: testCollege.id,
        currentYear: 'freshman',
        graduationYear: 2026
      })).rejects.toThrow();
    });

    test('Should enforce unique userId constraint', async () => {
      // Créer le premier profil
      await PlayerProfile.create({
        userId: testUser.id,
        dateOfBirth: new Date('2003-01-01'),
        height: 175,
        weight: 70,
        position: 'midfielder',
        gender: 'male',
        collegeId: testCollege.id,
        currentYear: 'freshman',
        graduationYear: 2026
      });

      // Tenter de créer un second profil avec le même userId
      await expect(PlayerProfile.create({
        userId: testUser.id, // Même userId
        dateOfBirth: new Date('2002-01-01'),
        height: 180,
        weight: 75,
        position: 'forward',
        gender: 'male',
        collegeId: testCollege.id,
        currentYear: 'sophomore',
        graduationYear: 2025
      })).rejects.toThrow();
    });
  });

  describe('🔧 Instance Methods', () => {
    let playerProfile;

    beforeEach(async () => {
      playerProfile = await PlayerProfile.create({
        userId: testUser.id,
        dateOfBirth: new Date('2003-06-15'),
        height: 178,
        weight: 72,
        position: 'midfielder',
        gender: 'male',
        collegeId: testCollege.id,
        currentYear: 'sophomore',
        graduationYear: 2025,
        gpa: 3.4,
        isProfileVisible: true
      });
    });

    test('Should calculate age correctly', () => {
      const age = playerProfile.getAge();
      const expectedAge = new Date().getFullYear() - 2003;
      
      // L'âge peut varier de ±1 selon la date actuelle vs date d'anniversaire
      expect(age).toBeGreaterThanOrEqual(expectedAge - 1);
      expect(age).toBeLessThanOrEqual(expectedAge + 1);
      expect(typeof age).toBe('number');
    });

    test('Should determine NJCAA eligibility status', () => {
      const isEligible = playerProfile.isNJCAAEligible();
      
      // Un joueur de 20-21 ans en sophomore année devrait être éligible
      expect(isEligible).toBe(true);
      expect(typeof isEligible).toBe('boolean');
    });

    test('Should check if profile is complete', () => {
      // Profil complet avec toutes les données
      const isComplete = playerProfile.isProfileComplete();
      expect(isComplete).toBe(true);

      // Profil incomplet sans GPA
      playerProfile.gpa = null;
      const isIncomplete = playerProfile.isProfileComplete();
      expect(isIncomplete).toBe(false);
    });

    test('Should return public JSON without sensitive data', () => {
      const publicData = playerProfile.toPublicJSON();

      // Vérifier les données présentes
      expect(publicData).toHaveProperty('id');
      expect(publicData).toHaveProperty('position');
      expect(publicData).toHaveProperty('height');
      expect(publicData).toHaveProperty('gender');
      expect(publicData).toHaveProperty('currentYear');
      expect(publicData).toHaveProperty('graduationYear');

      // Vérifier que les données sensibles ne sont pas exposées
      expect(publicData).not.toHaveProperty('userId');
      expect(publicData).not.toHaveProperty('gpa'); // GPA considéré comme sensible
      expect(publicData).not.toHaveProperty('weight'); // Poids peut être sensible
      
      // Date de naissance transformée en âge pour préserver la vie privée
      expect(publicData).toHaveProperty('age');
      expect(publicData).not.toHaveProperty('dateOfBirth');
    });

    test('Should calculate BMI (Body Mass Index)', () => {
      const bmi = playerProfile.calculateBMI();
      
      // BMI = poids(kg) / (taille(m))^2
      // 72 / (1.78)^2 = 22.7 environ
      expect(bmi).toBeCloseTo(22.7, 1);
      expect(typeof bmi).toBe('number');
    });

    test('Should determine academic standing', () => {
      // Test avec un bon GPA
      playerProfile.gpa = 3.4;
      let standing = playerProfile.getAcademicStanding();
      expect(['good', 'excellent']).toContain(standing);

      // Test avec un GPA moyen
      playerProfile.gpa = 2.5;
      standing = playerProfile.getAcademicStanding();
      expect(standing).toBe('average');

      // Test avec un GPA faible
      playerProfile.gpa = 1.8;
      standing = playerProfile.getAcademicStanding();
      expect(standing).toBe('probation');
    });
  });

  describe('🔗 Model Associations', () => {
    let playerProfile;

    beforeEach(async () => {
      playerProfile = await PlayerProfile.create({
        userId: testUser.id,
        dateOfBirth: new Date('2003-01-01'),
        height: 175,
        weight: 70,
        position: 'midfielder',
        gender: 'male',
        collegeId: testCollege.id,
        currentYear: 'freshman',
        graduationYear: 2026
      });
    });

    test('Should have association with User', async () => {
      const profileWithUser = await PlayerProfile.findByPk(playerProfile.id, {
        include: [{ model: User, as: 'user' }]
      });

      expect(profileWithUser.user).toBeDefined();
      expect(profileWithUser.user.id).toBe(testUser.id);
      expect(profileWithUser.user.userType).toBe('player');
      expect(profileWithUser.user.email).toBe('player.model.test@example.com');
    });

    test('Should have association with NJCAACollege', async () => {
      const profileWithCollege = await PlayerProfile.findByPk(playerProfile.id, {
        include: [{ model: NJCAACollege, as: 'college' }]
      });

      expect(profileWithCollege.college).toBeDefined();
      expect(profileWithCollege.college.id).toBe(testCollege.id);
      expect(profileWithCollege.college.name).toBe(testCollege.name);
      expect(profileWithCollege.college.state).toBe(testCollege.state);
    });

    test('Should load complete profile with all associations', async () => {
      const completeProfile = await PlayerProfile.findByPk(playerProfile.id, {
        include: [
          { model: User, as: 'user' },
          { model: NJCAACollege, as: 'college' }
        ]
      });

      expect(completeProfile.user).toBeDefined();
      expect(completeProfile.college).toBeDefined();
      expect(completeProfile.user.userType).toBe('player');
      expect(completeProfile.college.isActive).toBe(true);
    });
  });

  describe('📊 Static Methods and Queries', () => {
    let profiles;

    beforeEach(async () => {
      // Créer plusieurs profils pour tester les requêtes
      const user1 = await User.create({
        email: 'query.test1@example.com',
        password: 'TestPassword123!',
        firstName: 'Query',
        lastName: 'Test1',
        userType: 'player'
      });

      const user2 = await User.create({
        email: 'query.test2@example.com',
        password: 'TestPassword123!',
        firstName: 'Query',
        lastName: 'Test2',
        userType: 'player'
      });

      profiles = await Promise.all([
        PlayerProfile.create({
          userId: user1.id,
          dateOfBirth: new Date('2003-01-01'),
          height: 175,
          weight: 70,
          position: 'midfielder',
          gender: 'male',
          collegeId: testCollege.id,
          currentYear: 'freshman',
          graduationYear: 2026,
          gpa: 3.5,
          isProfileVisible: true
        }),
        PlayerProfile.create({
          userId: user2.id,
          dateOfBirth: new Date('2002-06-15'),
          height: 165,
          weight: 60,
          position: 'forward',
          gender: 'female',
          collegeId: testCollege.id,
          currentYear: 'sophomore',
          graduationYear: 2025,
          gpa: 3.8,
          isProfileVisible: false // Profil non visible
        })
      ]);
    });

    test('Should find visible profiles only', async () => {
      const visibleProfiles = await PlayerProfile.findAll({
        where: { isProfileVisible: true }
      });

      expect(visibleProfiles.length).toBe(1);
      expect(visibleProfiles[0].gender).toBe('male');
      expect(visibleProfiles[0].isProfileVisible).toBe(true);
    });

    test('Should filter by gender', async () => {
      const maleProfiles = await PlayerProfile.findAll({
        where: { gender: 'male' }
      });

      const femaleProfiles = await PlayerProfile.findAll({
        where: { gender: 'female' }
      });

      expect(maleProfiles.length).toBe(1);
      expect(femaleProfiles.length).toBe(1);
      expect(maleProfiles[0].position).toBe('midfielder');
      expect(femaleProfiles[0].position).toBe('forward');
    });

    test('Should filter by position', async () => {
      const midfielders = await PlayerProfile.findAll({
        where: { position: 'midfielder' }
      });

      const forwards = await PlayerProfile.findAll({
        where: { position: 'forward' }
      });

      expect(midfielders.length).toBe(1);
      expect(forwards.length).toBe(1);
      expect(midfielders[0].gender).toBe('male');
      expect(forwards[0].gender).toBe('female');
    });

    test('Should filter by college', async () => {
      const profilesInCollege = await PlayerProfile.findAll({
        where: { collegeId: testCollege.id }
      });

      expect(profilesInCollege.length).toBe(2);
      expect(profilesInCollege.every(p => p.collegeId === testCollege.id)).toBe(true);
    });

    test('Should filter by graduation year', async () => {
      const graduating2025 = await PlayerProfile.findAll({
        where: { graduationYear: 2025 }
      });

      const graduating2026 = await PlayerProfile.findAll({
        where: { graduationYear: 2026 }
      });

      expect(graduating2025.length).toBe(1);
      expect(graduating2026.length).toBe(1);
      expect(graduating2025[0].currentYear).toBe('sophomore');
      expect(graduating2026[0].currentYear).toBe('freshman');
    });
  });

  describe('🔒 Data Privacy and Security', () => {
    let playerProfile;

    beforeEach(async () => {
      playerProfile = await PlayerProfile.create({
        userId: testUser.id,
        dateOfBirth: new Date('2003-01-01'),
        height: 175,
        weight: 70,
        position: 'midfielder',
        gender: 'male',
        collegeId: testCollege.id,
        currentYear: 'freshman',
        graduationYear: 2026,
        gpa: 3.5,
        isProfileVisible: true
      });
    });

    test('Should respect profile visibility settings', async () => {
      // Profil visible
      playerProfile.isProfileVisible = true;
      await playerProfile.save();
      
      const visibleProfile = await PlayerProfile.findOne({
        where: { id: playerProfile.id, isProfileVisible: true }
      });
      expect(visibleProfile).toBeDefined();

      // Profil non visible
      playerProfile.isProfileVisible = false;
      await playerProfile.save();
      
      const hiddenProfile = await PlayerProfile.findOne({
        where: { id: playerProfile.id, isProfileVisible: true }
      });
      expect(hiddenProfile).toBeNull();
    });

    test('Should not expose sensitive data in API responses', () => {
      const apiResponse = playerProfile.toPublicJSON();

      // Données qui DEVRAIENT être exposées (publiques)
      expect(apiResponse).toHaveProperty('position');
      expect(apiResponse).toHaveProperty('height');
      expect(apiResponse).toHaveProperty('currentYear');
      expect(apiResponse).toHaveProperty('graduationYear');

      // Données qui NE DEVRAIENT PAS être exposées (sensibles)
      expect(apiResponse).not.toHaveProperty('userId');
      expect(apiResponse).not.toHaveProperty('dateOfBirth');
      expect(apiResponse).not.toHaveProperty('gpa');
      expect(apiResponse).not.toHaveProperty('weight');
    });

    test('Should handle data anonymization for age display', () => {
      const publicData = playerProfile.toPublicJSON();
      
      // Age calculé au lieu de date de naissance exacte
      expect(publicData).toHaveProperty('age');
      expect(typeof publicData.age).toBe('number');
      expect(publicData.age).toBeGreaterThan(0);
      expect(publicData.age).toBeLessThan(100);
    });
  });
});