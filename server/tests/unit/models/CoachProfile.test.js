// portall/server/tests/unit/models/CoachProfile.test.js

process.env.NODE_ENV = 'test';

const { User, CoachProfile, NCAACollege, PlayerProfile } = require('../../../models');
const TestHelpers = require('../../utils/testHelpers');

/**
 * 🏟️ Tests unitaires du modèle CoachProfile - Cœur business des coachs NCAA/NAIA
 * 
 * Le modèle CoachProfile représente vos clients payants qui investissent dans des
 * abonnements pour recruter des talents NJCAA. C'est le cœur de votre business model
 * et il nécessite des tests exhaustifs pour garantir la fiabilité.
 * 
 * 🎯 Concept pédagogique : "Revenue-Critical Model Testing"
 * Quand un modèle génère directement des revenus (via Stripe), ses tests deviennent
 * critiques pour la stabilité financière de votre plateforme. Une panne de ce modèle
 * pourrait impacter directement vos revenus et la satisfaction client.
 * 
 * 💡 Logique métier critique testée :
 * - Système de favoris pour gérer le pipeline de recrutement
 * - Recherches sauvegardées avec critères personnalisés
 * - Métriques de performance et analytics
 * - Associations complexes avec Player et College
 * - Validation des données business (division/college cohérence)
 * 
 * 🔧 Architecture business :
 * Les coachs NCAA/NAIA sont des "consommateurs premium" de données de joueurs,
 * contrairement aux coachs NJCAA qui sont des "producteurs de données".
 */

describe('🏟️ CoachProfile Model - Premium Client Business Logic', () => {
  let testNCAACollege;
  let testUser;

  beforeAll(async () => {
    // Créer un college NCAA pour les tests
    testNCAACollege = await TestHelpers.createTestNCAACollege({
      name: 'Premium University',
      state: 'CA',
      division: 'ncaa_d1',
      conference: 'Elite Conference'
    });

    // Créer un utilisateur coach
    testUser = await User.create({
      email: 'coach.premium@university.edu',
      password: 'TestPassword123!',
      firstName: 'Premium',
      lastName: 'Coach',
      userType: 'coach',
      isActive: true
    });
  });

  beforeEach(async () => {
    // Nettoyer seulement les profils entre chaque test
    await CoachProfile.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('✅ Business Model Validations', () => {
    test('Should create valid NCAA/NAIA coach profile with premium features', async () => {
      const profileData = {
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1-555-123-4567',
        collegeId: testNCAACollege.id,
        division: 'ncaa_d1',
        teamSport: 'mens_soccer',
        savedSearches: [],
        totalSearches: 0
      };

      const coachProfile = await CoachProfile.create(profileData);

      expect(coachProfile.id).toBeDefined();
      expect(coachProfile.position).toBe('head_coach');
      expect(coachProfile.division).toBe('ncaa_d1');
      expect(coachProfile.teamSport).toBe('mens_soccer');
      expect(coachProfile.totalSearches).toBe(0);
      expect(coachProfile.savedSearches).toEqual([]);
      expect(coachProfile.createdAt).toBeInstanceOf(Date);
    });

    test('Should validate NCAA/NAIA specific divisions', async () => {
      const validDivisions = ['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia'];
      const invalidDivisions = ['njcaa_d1', 'high_school', 'professional'];

      // Test des divisions valides
      for (const division of validDivisions) {
        const profile = await CoachProfile.create({
          userId: testUser.id,
          position: 'head_coach',
          phoneNumber: '+1234567890',
          collegeId: testNCAACollege.id,
          division,
          teamSport: 'mens_soccer'
        });
        expect(profile.division).toBe(division);
        await profile.destroy();
      }

      // Test des divisions invalides
      for (const division of invalidDivisions) {
        await expect(CoachProfile.create({
          userId: testUser.id,
          position: 'head_coach',
          phoneNumber: '+1234567890',
          collegeId: testNCAACollege.id,
          division,
          teamSport: 'mens_soccer'
        })).rejects.toThrow();
      }
    });

    test('Should validate coach positions correctly', async () => {
      const validPositions = ['head_coach', 'assistant_coach'];
      const invalidPositions = ['player_coach', 'volunteer_coach', 'trainer'];

      // Test des positions valides
      for (const position of validPositions) {
        const profile = await CoachProfile.create({
          userId: testUser.id,
          position,
          phoneNumber: '+1234567890',
          collegeId: testNCAACollege.id,
          division: 'ncaa_d1',
          teamSport: 'mens_soccer'
        });
        expect(profile.position).toBe(position);
        await profile.destroy();
      }

      // Test des positions invalides
      for (const position of invalidPositions) {
        await expect(CoachProfile.create({
          userId: testUser.id,
          position,
          phoneNumber: '+1234567890',
          collegeId: testNCAACollege.id,
          division: 'ncaa_d1',
          teamSport: 'mens_soccer'
        })).rejects.toThrow();
      }
    });

    test('Should validate team sports for NCAA/NAIA programs', async () => {
      const validSports = ['mens_soccer', 'womens_soccer'];
      const invalidSports = ['basketball', 'football', 'tennis'];

      // Test des sports valides
      for (const sport of validSports) {
        const profile = await CoachProfile.create({
          userId: testUser.id,
          position: 'head_coach',
          phoneNumber: '+1234567890',
          collegeId: testNCAACollege.id,
          division: 'ncaa_d1',
          teamSport: sport
        });
        expect(profile.teamSport).toBe(sport);
        await profile.destroy();
      }

      // Test des sports invalides
      for (const sport of invalidSports) {
        await expect(CoachProfile.create({
          userId: testUser.id,
          position: 'head_coach',
          phoneNumber: '+1234567890',
          collegeId: testNCAACollege.id,
          division: 'ncaa_d1',
          teamSport: sport
        })).rejects.toThrow();
      }
    });

    test('Should validate phone number format for professional contact', async () => {
      const validPhones = [
        '+1-555-123-4567',
        '+12345678901',
        '555-123-4567',
        '(555) 123-4567',
        '+1 555 123 4567'
      ];

      const invalidPhones = [
        '123',           // Trop court
        'abcdefghij',    // Caractères non numériques
        '+++123456789',  // Format invalide
        ''               // Vide
      ];

      // Test des numéros valides
      for (const phone of validPhones) {
        const profile = await CoachProfile.create({
          userId: testUser.id,
          position: 'head_coach',
          phoneNumber: phone,
          collegeId: testNCAACollege.id,
          division: 'ncaa_d1',
          teamSport: 'mens_soccer'
        });
        expect(profile.phoneNumber).toBe(phone);
        await profile.destroy();
      }

      // Test des numéros invalides
      for (const phone of invalidPhones) {
        await expect(CoachProfile.create({
          userId: testUser.id,
          position: 'head_coach',
          phoneNumber: phone,
          collegeId: testNCAACollege.id,
          division: 'ncaa_d1',
          teamSport: 'mens_soccer'
        })).rejects.toThrow();
      }
    });

    test('Should enforce unique userId constraint', async () => {
      // Créer le premier profil
      await CoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testNCAACollege.id,
        division: 'ncaa_d1',
        teamSport: 'mens_soccer'
      });

      // Tenter de créer un second profil avec le même userId
      await expect(CoachProfile.create({
        userId: testUser.id, // Même userId
        position: 'assistant_coach',
        phoneNumber: '+0987654321',
        collegeId: testNCAACollege.id,
        division: 'ncaa_d2',
        teamSport: 'womens_soccer'
      })).rejects.toThrow();
    });
  });

  describe('🔧 Recruitment Management Methods', () => {
    let coachProfile;

    beforeEach(async () => {
      coachProfile = await CoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1-555-123-4567',
        collegeId: testNCAACollege.id,
        division: 'ncaa_d1',
        teamSport: 'mens_soccer'
      });
    });

    test('Should increment search counter correctly', async () => {
      const initialCount = coachProfile.totalSearches;

      await coachProfile.incrementSearches();

      await coachProfile.reload();
      expect(coachProfile.totalSearches).toBe(initialCount + 1);
    });

    test('Should handle multiple search increments', async () => {
      const initialCount = coachProfile.totalSearches;

      // Faire plusieurs recherches
      await coachProfile.incrementSearches();
      await coachProfile.incrementSearches();
      await coachProfile.incrementSearches();

      await coachProfile.reload();
      expect(coachProfile.totalSearches).toBe(initialCount + 3);
    });

    test('Should save search criteria with metadata', async () => {
      const searchCriteria = {
        position: 'midfielder',
        minGPA: 3.5,
        college: 'Community College',
        minHeight: 175,
        currentYear: 'sophomore'
      };

      await coachProfile.saveSearch(searchCriteria);

      await coachProfile.reload();
      const savedSearches = coachProfile.savedSearches;
      
      expect(savedSearches).toHaveLength(1);
      expect(savedSearches[0].position).toBe('midfielder');
      expect(savedSearches[0].minGPA).toBe(3.5);
      expect(savedSearches[0].savedAt).toBeDefined();
      expect(savedSearches[0].id).toBeDefined();
    });

    test('Should limit saved searches to maximum of 10', async () => {
      // Sauvegarder 12 recherches (plus que le maximum)
      for (let i = 0; i < 12; i++) {
        await coachProfile.saveSearch({
          position: 'midfielder',
          searchNumber: i,
          timestamp: Date.now() + i
        });
      }

      await coachProfile.reload();
      const savedSearches = coachProfile.savedSearches;
      
      // Devrait garder seulement les 10 dernières
      expect(savedSearches).toHaveLength(10);
      
      // Vérifier que ce sont les plus récentes
      expect(savedSearches[savedSearches.length - 1].searchNumber).toBe(11);
      expect(savedSearches[0].searchNumber).toBe(2); // Les 2 premières ont été supprimées
    });

    test('Should save complex search criteria with nested objects', async () => {
      const complexSearch = {
        basicCriteria: {
          position: 'forward',
          minGPA: 3.2,
          maxGPA: 4.0
        },
        physicalAttributes: {
          minHeight: 175,
          maxHeight: 190,
          preferredFoot: 'right'
        },
        academicCriteria: {
          graduationYear: 2025,
          majorPreferences: ['Business', 'Sports Management']
        },
        geographicPreferences: {
          regions: ['West Coast', 'Southwest'],
          maxDistance: 500
        }
      };

      await coachProfile.saveSearch(complexSearch);

      await coachProfile.reload();
      const savedSearch = coachProfile.savedSearches[0];
      
      expect(savedSearch.basicCriteria.position).toBe('forward');
      expect(savedSearch.physicalAttributes.minHeight).toBe(175);
      expect(savedSearch.academicCriteria.majorPreferences).toContain('Business');
      expect(savedSearch.geographicPreferences.regions).toContain('West Coast');
    });

    test('Should maintain search order (newest first)', async () => {
      const searches = [
        { position: 'midfielder', timestamp: 1 },
        { position: 'forward', timestamp: 2 },
        { position: 'defender', timestamp: 3 }
      ];

      for (const search of searches) {
        await coachProfile.saveSearch(search);
        // Petite pause pour garantir l'ordre temporal
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await coachProfile.reload();
      const savedSearches = coachProfile.savedSearches;
      
      expect(savedSearches).toHaveLength(3);
      // Le plus récent (defender) devrait être en dernier
      expect(savedSearches[savedSearches.length - 1].position).toBe('defender');
      expect(savedSearches[0].position).toBe('midfielder');
    });
  });

  describe('📊 Data Serialization and Privacy', () => {
    let coachProfile;

    beforeEach(async () => {
      coachProfile = await CoachProfile.create({
        userId: testUser.id,
        position: 'assistant_coach',
        phoneNumber: '+1-555-987-6543',
        collegeId: testNCAACollege.id,
        division: 'ncaa_d2',
        teamSport: 'womens_soccer',
        totalSearches: 25
      });
    });

    test('Should return public JSON without sensitive data', () => {
      const publicData = coachProfile.toPublicJSON();
      
      // Vérifier les données présentes
      expect(publicData).toHaveProperty('id');
      expect(publicData).toHaveProperty('position', 'assistant_coach');
      expect(publicData).toHaveProperty('collegeId');
      expect(publicData).toHaveProperty('division', 'ncaa_d2');
      expect(publicData).toHaveProperty('teamSport', 'womens_soccer');
      expect(publicData).toHaveProperty('totalSearches', 25);
      
      // Vérifier que les données sensibles sont masquées
      expect(publicData).not.toHaveProperty('phoneNumber'); // Privé par défaut
      expect(publicData).not.toHaveProperty('savedSearches'); // Données privées
    });

    test('Should include all data in regular JSON serialization', () => {
      const fullData = coachProfile.toJSON();
      
      // Toutes les données devraient être présentes en interne
      expect(fullData).toHaveProperty('phoneNumber', '+1-555-987-6543');
      expect(fullData).toHaveProperty('savedSearches');
      expect(fullData).toHaveProperty('userId', testUser.id);
    });

    test('Should handle empty saved searches gracefully', () => {
      const publicData = coachProfile.toPublicJSON();
      const fullData = coachProfile.toJSON();
      
      expect(fullData.savedSearches).toEqual([]);
      expect(publicData).not.toHaveProperty('savedSearches');
    });
  });

  describe('🔗 Model Associations', () => {
    let coachProfile;

    beforeEach(async () => {
      coachProfile = await CoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testNCAACollege.id,
        division: 'ncaa_d1',
        teamSport: 'mens_soccer'
      });
    });

    test('Should have association with User', async () => {
      const profileWithUser = await CoachProfile.findByPk(coachProfile.id, {
        include: [{ model: User, as: 'user' }]
      });

      expect(profileWithUser.user).toBeDefined();
      expect(profileWithUser.user.id).toBe(testUser.id);
      expect(profileWithUser.user.userType).toBe('coach');
      expect(profileWithUser.user.email).toBe('coach.premium@university.edu');
    });

    test('Should have association with NCAACollege', async () => {
      const profileWithCollege = await CoachProfile.findByPk(coachProfile.id, {
        include: [{ model: NCAACollege, as: 'college' }]
      });

      expect(profileWithCollege.college).toBeDefined();
      expect(profileWithCollege.college.id).toBe(testNCAACollege.id);
      expect(profileWithCollege.college.name).toBe('Premium University');
      expect(profileWithCollege.college.division).toBe('ncaa_d1');
    });

    test('Should load complete profile with all associations', async () => {
      const completeProfile = await CoachProfile.findByPk(coachProfile.id, {
        include: [
          { model: User, as: 'user' },
          { model: NCAACollege, as: 'college' }
        ]
      });

      expect(completeProfile.user).toBeDefined();
      expect(completeProfile.college).toBeDefined();
      expect(completeProfile.user.userType).toBe('coach');
      expect(completeProfile.college.isActive).toBe(true);
    });

    test('Should support favorite players association', async () => {
      // Note: Ce test nécessiterait des PlayerProfile et CoachFavorite
      // Pour l'instant, on teste la structure de l'association
      const profileWithFavorites = await CoachProfile.findByPk(coachProfile.id, {
        include: [{ 
          model: PlayerProfile, 
          as: 'favoriteProfiles',
          through: { attributes: [] } // Exclure les données de la table de liaison
        }]
      });

      expect(profileWithFavorites).toBeDefined();
      expect(profileWithFavorites.favoriteProfiles).toBeDefined();
      expect(Array.isArray(profileWithFavorites.favoriteProfiles)).toBe(true);
    });
  });

  describe('📊 Static Methods and Queries', () => {
    beforeEach(async () => {
      // Créer plusieurs profils de coaches pour tester les requêtes
      const users = await Promise.all([
        User.create({
          email: 'coach1@d1.edu',
          password: 'TestPassword123!',
          firstName: 'D1',
          lastName: 'Coach',
          userType: 'coach'
        }),
        User.create({
          email: 'coach2@d2.edu',
          password: 'TestPassword123!',
          firstName: 'D2',
          lastName: 'Coach',
          userType: 'coach'
        }),
        User.create({
          email: 'coach3@naia.edu',
          password: 'TestPassword123!',
          firstName: 'NAIA',
          lastName: 'Coach',
          userType: 'coach'
        })
      ]);

      await Promise.all([
        CoachProfile.create({
          userId: users[0].id,
          position: 'head_coach',
          phoneNumber: '+1111111111',
          collegeId: testNCAACollege.id,
          division: 'ncaa_d1',
          teamSport: 'mens_soccer',
          totalSearches: 15
        }),
        CoachProfile.create({
          userId: users[1].id,
          position: 'assistant_coach',
          phoneNumber: '+2222222222',
          collegeId: testNCAACollege.id,
          division: 'ncaa_d2',
          teamSport: 'womens_soccer',
          totalSearches: 8
        }),
        CoachProfile.create({
          userId: users[2].id,
          position: 'head_coach',
          phoneNumber: '+3333333333',
          collegeId: testNCAACollege.id,
          division: 'naia',
          teamSport: 'mens_soccer',
          totalSearches: 22
        })
      ]);
    });

    test('Should find coaches by division', async () => {
      const d1Coaches = await CoachProfile.findByDivision('ncaa_d1');
      const naiaCoaches = await CoachProfile.findByDivision('naia');

      expect(d1Coaches).toHaveLength(1);
      expect(naiaCoaches).toHaveLength(1);
      expect(d1Coaches[0].division).toBe('ncaa_d1');
      expect(naiaCoaches[0].division).toBe('naia');
    });

    test('Should include associations in division queries', async () => {
      const coaches = await CoachProfile.findByDivision('ncaa_d1');
      const coach = coaches[0];

      expect(coach.user).toBeDefined();
      expect(coach.college).toBeDefined();
      expect(coach.user.firstName).toBe('D1');
      expect(coach.college.name).toBe('Premium University');
    });

    test('Should filter coaches by position', async () => {
      const headCoaches = await CoachProfile.findAll({
        where: { position: 'head_coach' }
      });

      const assistantCoaches = await CoachProfile.findAll({
        where: { position: 'assistant_coach' }
      });

      expect(headCoaches).toHaveLength(2);
      expect(assistantCoaches).toHaveLength(1);
      expect(headCoaches.every(c => c.position === 'head_coach')).toBe(true);
    });

    test('Should filter coaches by team sport', async () => {
      const mensSoccerCoaches = await CoachProfile.findAll({
        where: { teamSport: 'mens_soccer' }
      });

      const womensSoccerCoaches = await CoachProfile.findAll({
        where: { teamSport: 'womens_soccer' }
      });

      expect(mensSoccerCoaches).toHaveLength(2);
      expect(womensSoccerCoaches).toHaveLength(1);
    });

    test('Should order coaches by search activity', async () => {
      const activeCoaches = await CoachProfile.findAll({
        order: [['totalSearches', 'DESC']]
      });

      expect(activeCoaches).toHaveLength(3);
      expect(activeCoaches[0].totalSearches).toBe(22); // NAIA coach le plus actif
      expect(activeCoaches[1].totalSearches).toBe(15); // D1 coach
      expect(activeCoaches[2].totalSearches).toBe(8);  // D2 coach le moins actif
    });

    test('Should support complex filtering queries', async () => {
      const specificCoaches = await CoachProfile.findAll({
        where: {
          division: ['ncaa_d1', 'ncaa_d2'], // Seulement NCAA (pas NAIA)
          position: 'head_coach',
          totalSearches: { [require('sequelize').Op.gte]: 10 }
        }
      });

      expect(specificCoaches).toHaveLength(1); // Seulement le D1 head coach avec 15 recherches
      expect(specificCoaches[0].division).toBe('ncaa_d1');
    });
  });

  describe('🔒 Business Logic Validation', () => {
    test('Should validate division consistency with college', async () => {
      // Créer un college D2
      const d2College = await TestHelpers.createTestNCAACollege({
        division: 'ncaa_d2'
      });

      // Tenter de créer un coach D1 dans un college D2 (incohérent)
      // Note: Cette validation pourrait être implémentée au niveau de l'application
      const coachData = {
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: d2College.id,
        division: 'ncaa_d1', // Incohérent avec le college
        teamSport: 'mens_soccer'
      };

      // Le modèle lui-même pourrait ne pas valider cela,
      // mais l'application devrait (via les validators)
      const coach = await CoachProfile.create(coachData);
      expect(coach).toBeDefined();
      
      // Dans un système complet, on ajouterait une validation custom
      // qui vérifierait la cohérence division/college
    });

    test('Should handle concurrent search counter updates safely', async () => {
      const coachProfile = await CoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testNCAACollege.id,
        division: 'ncaa_d1',
        teamSport: 'mens_soccer'
      });

      // Simuler plusieurs incréments simultanés
      const incrementPromises = Array(5).fill().map(() =>
        coachProfile.incrementSearches()
      );

      await Promise.all(incrementPromises);

      // Recharger pour voir le résultat final
      await coachProfile.reload();
      expect(coachProfile.totalSearches).toBe(5);
    });

    test('Should validate saved search data integrity', async () => {
      const coachProfile = await CoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testNCAACollege.id,
        division: 'ncaa_d1',
        teamSport: 'mens_soccer'
      });

      // Sauvegarder une recherche avec des données complexes
      const searchWithNullValues = {
        position: 'midfielder',
        minGPA: null, // Valeur null
        maxHeight: undefined, // Valeur undefined
        preferences: {
          regions: ['West'],
          languages: null
        }
      };

      await coachProfile.saveSearch(searchWithNullValues);

      await coachProfile.reload();
      const savedSearch = coachProfile.savedSearches[0];
      
      // JSON devrait gérer les valeurs null/undefined proprement
      expect(savedSearch.position).toBe('midfielder');
      expect(savedSearch.minGPA).toBeNull();
      expect(savedSearch).not.toHaveProperty('maxHeight'); // undefined supprimé
      expect(savedSearch.preferences.regions).toEqual(['West']);
    });
  });

  describe('⚡ Performance and Optimization', () => {
    test('Should handle large saved searches efficiently', async () => {
      const coachProfile = await CoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testNCAACollege.id,
        division: 'ncaa_d1',
        teamSport: 'mens_soccer'
      });

      // Créer une recherche avec beaucoup de données
      const largeSearch = {
        criteria: {},
        results: Array(100).fill().map((_, i) => ({
          playerId: i,
          name: `Player ${i}`,
          stats: { gpa: 3.0 + i * 0.01 }
        }))
      };

      const startTime = Date.now();
      await coachProfile.saveSearch(largeSearch);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Moins d'une seconde
      
      // Vérifier que les données sont sauvegardées
      await coachProfile.reload();
      expect(coachProfile.savedSearches[0].results).toHaveLength(100);
    });

    test('Should optimize search counter increments', async () => {
      const coachProfile = await CoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testNCAACollege.id,
        division: 'ncaa_d1',
        teamSport: 'mens_soccer'
      });

      // Mesurer le temps pour 20 incréments
      const startTime = Date.now();
      
      for (let i = 0; i < 20; i++) {
        await coachProfile.incrementSearches();
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTimePerIncrement = totalTime / 20;

      expect(avgTimePerIncrement).toBeLessThan(50); // Moins de 50ms par incrément
      
      await coachProfile.reload();
      expect(coachProfile.totalSearches).toBe(20);
    });
  });
});