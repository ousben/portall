// portall/server/tests/unit/models/NJCAACoachProfile.test.js

process.env.NODE_ENV = 'test';

const { User, NJCAACoachProfile, NJCAACollege, PlayerProfile } = require('../../../models');
const TestHelpers = require('../../utils/testHelpers');

/**
 * 🏟️ Tests unitaires complets du modèle NJCAACoachProfile - Innovation Phase 5B
 * 
 * Le modèle NJCAACoachProfile représente une innovation majeure de votre Phase 5B.
 * Il permet aux coachs NJCAA d'évaluer les joueurs de leur propre institution,
 * créant un système d'évaluation interne différent du système de recrutement
 * des coachs NCAA/NAIA.
 * 
 * 🎯 Concept architectural : "Role-Based Behavior Modeling"
 * Ce modèle illustre comment un même type d'acteur (coach) peut avoir des
 * comportements différents selon son contexte (NJCAA vs NCAA/NAIA). Les coachs
 * NJCAA évaluent leurs propres joueurs, tandis que les coachs NCAA/NAIA
 * recherchent des talents externes.
 * 
 * 💡 Logique métier testée :
 * - Système de comptage d'évaluations
 * - Filtrage par genre selon l'équipe (mens_soccer vs womens_soccer)
 * - Association avec college et restriction géographique
 * - Méthodes de recherche et évaluation des joueurs
 */

describe('🏟️ NJCAACoachProfile Model - Phase 5B Innovation Tests', () => {
  let testCollege;
  let testUser;

  beforeAll(async () => {
    testCollege = await TestHelpers.createTestNJCAACollege({
      name: 'Test NJCAA Soccer College',
      state: 'TX',
      region: 'South',
      division: 'division_1'
    });

    testUser = await User.create({
      email: 'njcaa.coach.test@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'NJCAACoach',
      userType: 'njcaa_coach',
      isActive: true
    });
  });

  beforeEach(async () => {
    await NJCAACoachProfile.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('✅ Business Model Validations', () => {
    test('Should create valid NJCAA coach profile with evaluation tracking', async () => {
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
      expect(coachProfile.teamSport).toBe('mens_soccer');
      expect(coachProfile.totalEvaluations).toBe(0); // Commence à zéro
      expect(coachProfile.lastEvaluationDate).toBeNull(); // Pas encore d'évaluation
      expect(coachProfile.division).toBe('njcaa_d1');
    });

    test('Should validate enum values for NJCAA-specific fields', async () => {
      const validData = {
        userId: testUser.id,
        phoneNumber: '+1234567890',
        collegeId: testCollege.id
      };

      // Test des positions valides
      const validPositions = ['head_coach', 'assistant_coach'];
      for (const position of validPositions) {
        const profile = await NJCAACoachProfile.create({
          ...validData,
          position,
          division: 'njcaa_d1',
          teamSport: 'mens_soccer'
        });
        expect(profile.position).toBe(position);
        await profile.destroy();
      }

      // Test des divisions valides NJCAA
      const validDivisions = ['njcaa_d1', 'njcaa_d2', 'njcaa_d3'];
      for (const division of validDivisions) {
        const profile = await NJCAACoachProfile.create({
          ...validData,
          position: 'head_coach',
          division,
          teamSport: 'mens_soccer'
        });
        expect(profile.division).toBe(division);
        await profile.destroy();
      }

      // Test des sports d'équipe valides
      const validTeamSports = ['mens_soccer', 'womens_soccer'];
      for (const teamSport of validTeamSports) {
        const profile = await NJCAACoachProfile.create({
          ...validData,
          position: 'head_coach',
          division: 'njcaa_d1',
          teamSport
        });
        expect(profile.teamSport).toBe(teamSport);
        await profile.destroy();
      }
    });

    test('Should reject invalid enum values', async () => {
      const validData = {
        userId: testUser.id,
        phoneNumber: '+1234567890',
        collegeId: testCollege.id,
        division: 'njcaa_d1',
        teamSport: 'mens_soccer'
      };

      // Positions invalides
      await expect(NJCAACoachProfile.create({
        ...validData,
        position: 'invalid_position'
      })).rejects.toThrow();

      // Divisions invalides (pas de division NCAA dans NJCAA)
      await expect(NJCAACoachProfile.create({
        ...validData,
        position: 'head_coach',
        division: 'ncaa_d1'
      })).rejects.toThrow();

      // Sports invalides
      await expect(NJCAACoachProfile.create({
        ...validData,
        position: 'head_coach',
        teamSport: 'basketball'
      })).rejects.toThrow();
    });

    test('Should validate phone number format', async () => {
      const validData = {
        userId: testUser.id,
        position: 'head_coach',
        collegeId: testCollege.id,
        division: 'njcaa_d1',
        teamSport: 'mens_soccer'
      };

      // Numéros de téléphone invalides
      const invalidPhones = [
        '123',           // Trop court
        'abcdefghij',    // Caractères non numériques
        '123-456-789',   // Format incorrect
        '+12345'         // Trop court avec indicatif
      ];

      for (const phoneNumber of invalidPhones) {
        await expect(NJCAACoachProfile.create({
          ...validData,
          phoneNumber
        })).rejects.toThrow();
      }

      // Numéros de téléphone valides
      const validPhones = [
        '+1234567890',
        '+1-234-567-8901',
        '2345678901',
        '+33123456789'
      ];

      for (const phoneNumber of validPhones) {
        const profile = await NJCAACoachProfile.create({
          ...validData,
          phoneNumber
        });
        expect(profile.phoneNumber).toBe(phoneNumber);
        await profile.destroy();
      }
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

  describe('🔧 Evaluation System Methods', () => {
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

    test('Should increment evaluation count and update timestamp', async () => {
      const initialCount = coachProfile.totalEvaluations;
      const initialDate = coachProfile.lastEvaluationDate;

      // Incrémenter les évaluations
      await coachProfile.incrementEvaluations();

      // Recharger depuis la base de données
      await coachProfile.reload();

      expect(coachProfile.totalEvaluations).toBe(initialCount + 1);
      expect(coachProfile.lastEvaluationDate).not.toBe(initialDate);
      expect(coachProfile.lastEvaluationDate).toBeInstanceOf(Date);
      
      // La date doit être récente (moins d'une minute)
      const timeDiff = Date.now() - coachProfile.lastEvaluationDate.getTime();
      expect(timeDiff).toBeLessThan(60000); // Moins d'une minute
    });

    test('Should handle multiple consecutive evaluations', async () => {
      const initialCount = coachProfile.totalEvaluations;

      // Faire plusieurs évaluations
      await coachProfile.incrementEvaluations();
      await coachProfile.incrementEvaluations();
      await coachProfile.incrementEvaluations();

      await coachProfile.reload();
      expect(coachProfile.totalEvaluations).toBe(initialCount + 3);
    });

    test('Should track evaluation activity over time', async () => {
      // Première évaluation
      await coachProfile.incrementEvaluations();
      await coachProfile.reload();
      const firstEvaluationDate = coachProfile.lastEvaluationDate;

      // Attendre un peu (simulation du temps)
      await new Promise(resolve => setTimeout(resolve, 10));

      // Deuxième évaluation
      await coachProfile.incrementEvaluations();
      await coachProfile.reload();
      const secondEvaluationDate = coachProfile.lastEvaluationDate;

      // La seconde date doit être plus récente
      expect(secondEvaluationDate.getTime()).toBeGreaterThan(firstEvaluationDate.getTime());
      expect(coachProfile.totalEvaluations).toBe(2);
    });
  });

  describe('👥 Player Management System', () => {
    let coachProfile;
    let malePlayer;
    let femalePlayer;

    beforeEach(async () => {
      coachProfile = await NJCAACoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testCollege.id,
        division: 'njcaa_d1',
        teamSport: 'mens_soccer'
      });

      // Créer des joueurs des deux genres dans le même college
      const malePlayerData = await TestHelpers.createTestPlayer({
        college: testCollege,
        profile: {
          gender: 'male',
          position: 'midfielder',
          currentYear: 'freshman',
          isProfileVisible: true
        }
      });
      malePlayer = malePlayerData.profile;

      const femalePlayerData = await TestHelpers.createTestPlayer({
        college: testCollege,
        profile: {
          gender: 'female',
          position: 'forward',
          currentYear: 'sophomore',
          isProfileVisible: true
        }
      });
      femalePlayer = femalePlayerData.profile;
    });

    test('Should get male players for mens soccer coach', async () => {
      // Coach d'équipe masculine devrait voir seulement les joueurs masculins
      coachProfile.teamSport = 'mens_soccer';
      await coachProfile.save();

      const myPlayers = await coachProfile.getMyPlayers();

      expect(myPlayers).toHaveLength(1);
      expect(myPlayers[0].gender).toBe('male');
      expect(myPlayers[0].collegeId).toBe(testCollege.id);
      expect(myPlayers[0].id).toBe(malePlayer.id);
    });

    test('Should get female players for womens soccer coach', async () => {
      // Coach d'équipe féminine devrait voir seulement les joueuses
      coachProfile.teamSport = 'womens_soccer';
      await coachProfile.save();

      const myPlayers = await coachProfile.getMyPlayers();

      expect(myPlayers).toHaveLength(1);
      expect(myPlayers[0].gender).toBe('female');
      expect(myPlayers[0].collegeId).toBe(testCollege.id);
      expect(myPlayers[0].id).toBe(femalePlayer.id);
    });

    test('Should only return players from same college', async () => {
      // Créer un autre college avec des joueurs
      const otherCollege = await TestHelpers.createTestNJCAACollege({
        name: 'Other NJCAA College',
        state: 'CA'
      });

      await TestHelpers.createTestPlayer({
        college: otherCollege,
        profile: {
          gender: 'male',
          position: 'defender',
          isProfileVisible: true
        }
      });

      const myPlayers = await coachProfile.getMyPlayers();

      // Devrait seulement voir les joueurs de son college
      expect(myPlayers).toHaveLength(1);
      expect(myPlayers[0].collegeId).toBe(testCollege.id);
      expect(myPlayers.every(p => p.collegeId === testCollege.id)).toBe(true);
    });

    test('Should only return visible player profiles', async () => {
      // Rendre le profil du joueur masculin non visible
      malePlayer.isProfileVisible = false;
      await malePlayer.save();

      const myPlayers = await coachProfile.getMyPlayers();

      // Ne devrait pas voir les profils cachés
      expect(myPlayers).toHaveLength(0);
    });

    test('Should include user information with player profiles', async () => {
      const myPlayers = await coachProfile.getMyPlayers();

      expect(myPlayers).toHaveLength(1);
      expect(myPlayers[0]).toHaveProperty('user');
      expect(myPlayers[0].user).toHaveProperty('firstName');
      expect(myPlayers[0].user).toHaveProperty('lastName');
      expect(myPlayers[0].user).toHaveProperty('email');
      expect(myPlayers[0].user.isActive).toBe(true);
    });

    test('Should order players by creation date (newest first)', async () => {
      // Créer un troisième joueur masculin plus récent
      const newerPlayerData = await TestHelpers.createTestPlayer({
        college: testCollege,
        profile: {
          gender: 'male',
          position: 'goalkeeper',
          currentYear: 'freshman',
          isProfileVisible: true
        }
      });

      const myPlayers = await coachProfile.getMyPlayers();

      expect(myPlayers).toHaveLength(2);
      // Le plus récent devrait être en premier
      expect(myPlayers[0].id).toBe(newerPlayerData.profile.id);
      expect(myPlayers[1].id).toBe(malePlayer.id);
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
      expect(profileWithUser.user.id).toBe(testUser.id);
      expect(profileWithUser.user.userType).toBe('njcaa_coach');
      expect(profileWithUser.user.email).toBe('njcaa.coach.test@example.com');
    });

    test('Should have association with NJCAACollege', async () => {
      const profileWithCollege = await NJCAACoachProfile.findByPk(coachProfile.id, {
        include: [{ model: NJCAACollege, as: 'college' }]
      });

      expect(profileWithCollege.college).toBeDefined();
      expect(profileWithCollege.college.id).toBe(testCollege.id);
      expect(profileWithCollege.college.name).toBe('Test NJCAA Soccer College');
      expect(profileWithCollege.college.state).toBe('TX');
    });

    test('Should load complete profile with all associations', async () => {
      const completeProfile = await NJCAACoachProfile.findByPk(coachProfile.id, {
        include: [
          { model: User, as: 'user' },
          { model: NJCAACollege, as: 'college' }
        ]
      });

      expect(completeProfile.user).toBeDefined();
      expect(completeProfile.college).toBeDefined();
      expect(completeProfile.user.userType).toBe('njcaa_coach');
      expect(completeProfile.college.isActive).toBe(true);
    });
  });

  describe('📊 Data Serialization', () => {
    let coachProfile;

    beforeEach(async () => {
      coachProfile = await NJCAACoachProfile.create({
        userId: testUser.id,
        position: 'assistant_coach',
        phoneNumber: '+1987654321',
        collegeId: testCollege.id,
        division: 'njcaa_d2',
        teamSport: 'womens_soccer',
        totalEvaluations: 5,
        lastEvaluationDate: new Date()
      });
    });

    test('Should return complete public JSON', () => {
      const publicData = coachProfile.toPublicJSON();

      // Vérifier que toutes les données importantes sont présentes
      expect(publicData).toHaveProperty('id');
      expect(publicData).toHaveProperty('position', 'assistant_coach');
      expect(publicData).toHaveProperty('phoneNumber', '+1987654321');
      expect(publicData).toHaveProperty('collegeId', testCollege.id);
      expect(publicData).toHaveProperty('division', 'njcaa_d2');
      expect(publicData).toHaveProperty('teamSport', 'womens_soccer');
      expect(publicData).toHaveProperty('totalEvaluations', 5);
      expect(publicData).toHaveProperty('lastEvaluationDate');
      expect(publicData).toHaveProperty('createdAt');
      expect(publicData).toHaveProperty('updatedAt');

      // Pour les coachs NJCAA, le numéro de téléphone est public
      // car ils travaillent avec leurs propres joueurs
      expect(publicData.phoneNumber).toBe('+1987654321');
    });

    test('Should include evaluation metrics in JSON', () => {
      const publicData = coachProfile.toPublicJSON();

      expect(publicData.totalEvaluations).toBe(5);
      expect(publicData.lastEvaluationDate).toBeInstanceOf(Date);
    });

    test('Should maintain data integrity in serialization', () => {
      const publicData = coachProfile.toPublicJSON();

      // Toutes les propriétés énumérées doivent avoir les bonnes valeurs
      expect(publicData.division).toBe('njcaa_d2');
      expect(publicData.teamSport).toBe('womens_soccer');
      expect(publicData.position).toBe('assistant_coach');
    });
  });

  describe('🔍 Query and Filtering Methods', () => {
    let profiles;

    beforeEach(async () => {
      // Créer plusieurs coachs pour tester les requêtes
      const users = await Promise.all([
        User.create({
          email: 'coach1@njcaa.edu',
          password: 'TestPassword123!',
          firstName: 'Coach',
          lastName: 'One',
          userType: 'njcaa_coach'
        }),
        User.create({
          email: 'coach2@njcaa.edu',
          password: 'TestPassword123!',
          firstName: 'Coach',
          lastName: 'Two',
          userType: 'njcaa_coach'
        }),
        User.create({
          email: 'coach3@njcaa.edu',
          password: 'TestPassword123!',
          firstName: 'Coach',
          lastName: 'Three',
          userType: 'njcaa_coach'
        })
      ]);

      profiles = await Promise.all([
        NJCAACoachProfile.create({
          userId: users[0].id,
          position: 'head_coach',
          phoneNumber: '+1111111111',
          collegeId: testCollege.id,
          division: 'njcaa_d1',
          teamSport: 'mens_soccer',
          totalEvaluations: 10
        }),
        NJCAACoachProfile.create({
          userId: users[1].id,
          position: 'assistant_coach',
          phoneNumber: '+2222222222',
          collegeId: testCollege.id,
          division: 'njcaa_d2',
          teamSport: 'womens_soccer',
          totalEvaluations: 5
        }),
        NJCAACoachProfile.create({
          userId: users[2].id,
          position: 'head_coach',
          phoneNumber: '+3333333333',
          collegeId: testCollege.id,
          division: 'njcaa_d1',
          teamSport: 'mens_soccer',
          totalEvaluations: 0
        })
      ]);
    });

    test('Should filter by position', async () => {
      const headCoaches = await NJCAACoachProfile.findAll({
        where: { position: 'head_coach' }
      });

      const assistantCoaches = await NJCAACoachProfile.findAll({
        where: { position: 'assistant_coach' }
      });

      expect(headCoaches.length).toBe(2);
      expect(assistantCoaches.length).toBe(1);
      expect(headCoaches.every(c => c.position === 'head_coach')).toBe(true);
      expect(assistantCoaches[0].position).toBe('assistant_coach');
    });

    test('Should filter by team sport', async () => {
      const mensSoccerCoaches = await NJCAACoachProfile.findAll({
        where: { teamSport: 'mens_soccer' }
      });

      const womensSoccerCoaches = await NJCAACoachProfile.findAll({
        where: { teamSport: 'womens_soccer' }
      });

      expect(mensSoccerCoaches.length).toBe(2);
      expect(womensSoccerCoaches.length).toBe(1);
      expect(mensSoccerCoaches.every(c => c.teamSport === 'mens_soccer')).toBe(true);
    });

    test('Should filter by division', async () => {
      const d1Coaches = await NJCAACoachProfile.findAll({
        where: { division: 'njcaa_d1' }
      });

      const d2Coaches = await NJCAACoachProfile.findAll({
        where: { division: 'njcaa_d2' }
      });

      expect(d1Coaches.length).toBe(2);
      expect(d2Coaches.length).toBe(1);
    });

    test('Should filter by college', async () => {
      const collegeCoaches = await NJCAACoachProfile.findAll({
        where: { collegeId: testCollege.id }
      });

      expect(collegeCoaches.length).toBe(3);
      expect(collegeCoaches.every(c => c.collegeId === testCollege.id)).toBe(true);
    });

    test('Should sort by evaluation activity', async () => {
      const activeCoaches = await NJCAACoachProfile.findAll({
        order: [['totalEvaluations', 'DESC']]
      });

      expect(activeCoaches[0].totalEvaluations).toBe(10);
      expect(activeCoaches[1].totalEvaluations).toBe(5);
      expect(activeCoaches[2].totalEvaluations).toBe(0);
    });
  });
});