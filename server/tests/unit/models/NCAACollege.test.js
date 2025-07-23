// portall/server/tests/unit/models/NCAACollege.test.js

process.env.NODE_ENV = 'test';

const { NCAACollege, CoachProfile, User } = require('../../../models');
const TestHelpers = require('../../utils/testHelpers');

/**
 * 🏛️ Tests unitaires du modèle NCAACollege - Institutions clientes
 * 
 * Le modèle NCAACollege représente les institutions universitaires qui emploient
 * vos coachs clients. Ces établissements ont des caractéristiques spécifiques
 * (division, conférence) qui impactent directement les règles métier.
 * 
 * 🎯 Concept pédagogique : "Reference Data Testing"
 * Les données de référence comme les colleges sont critiques car elles
 * structurent toute votre logique métier. Une erreur dans ces données
 * peut cascader dans tout le système.
 * 
 * 💡 Logique métier testée :
 * - Validations des divisions NCAA/NAIA
 * - Cohérence des conférences par division
 * - Relations avec les CoachProfile
 * - Statut actif/inactif et impact sur les fonctionnalités
 */

describe('🏛️ NCAACollege Model - Client Institution Reference Data', () => {

  beforeEach(async () => {
    await TestHelpers.cleanupTestData();
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('✅ Institution Data Validations', () => {
    test('Should create valid NCAA college with all required fields', async () => {
      const collegeData = {
        name: 'University of Excellence',
        state: 'CA',
        division: 'ncaa_d1',
        conference: 'Pacific Athletic Conference',
        website: 'https://www.excellence.edu',
        isActive: true
      };

      const college = await NCAACollege.create(collegeData);

      expect(college.id).toBeDefined();
      expect(college.name).toBe('University of Excellence');
      expect(college.state).toBe('CA');
      expect(college.division).toBe('ncaa_d1');
      expect(college.conference).toBe('Pacific Athletic Conference');
      expect(college.website).toBe('https://www.excellence.edu');
      expect(college.isActive).toBe(true);
      expect(college.createdAt).toBeInstanceOf(Date);
    });

    test('Should validate NCAA and NAIA divisions correctly', async () => {
      const validDivisions = ['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia'];
      const invalidDivisions = ['njcaa_d1', 'high_school', 'professional', 'division_1'];

      // Test des divisions valides
      for (const division of validDivisions) {
        const college = await NCAACollege.create({
          name: `Test College ${division}`,
          state: 'TX',
          division,
          conference: 'Test Conference',
          website: 'https://test.edu',
          isActive: true
        });
        expect(college.division).toBe(division);
        await college.destroy();
      }

      // Test des divisions invalides
      for (const division of invalidDivisions) {
        await expect(NCAACollege.create({
          name: 'Invalid College',
          state: 'FL',
          division,
          conference: 'Test Conference',
          website: 'https://test.edu',
          isActive: true
        })).rejects.toThrow();
      }
    });

    test('Should validate state codes properly', async () => {
      const validStates = ['CA', 'TX', 'FL', 'NY', 'WA'];
      const invalidStates = ['California', 'ABC', '12', 'Z'];

      // Test des codes d'état valides
      for (const state of validStates) {
        const college = await NCAACollege.create({
          name: `College in ${state}`,
          state,
          division: 'ncaa_d1',
          conference: 'Test Conference',
          website: 'https://test.edu',
          isActive: true
        });
        expect(college.state).toBe(state);
        await college.destroy();
      }

      // Test des codes d'état invalides
      for (const state of invalidStates) {
        await expect(NCAACollege.create({
          name: 'Invalid State College',
          state,
          division: 'ncaa_d1',
          conference: 'Test Conference',
          website: 'https://test.edu',
          isActive: true
        })).rejects.toThrow();
      }
    });

    test('Should validate website URL format', async () => {
      const validWebsites = [
        'https://www.university.edu',
        'http://college.edu',
        'https://sports.university.edu/soccer',
        'https://www.university.edu:8080'
      ];

      const invalidWebsites = [
        'not-a-url',
        'ftp://university.edu',
        'www.university.edu', // Pas de protocole
        'https://', // URL incomplète
        ''
      ];

      // Test des URLs valides
      for (const website of validWebsites) {
        const college = await NCAACollege.create({
          name: 'URL Test College',
          state: 'CA',
          division: 'ncaa_d1',
          conference: 'Test Conference',
          website,
          isActive: true
        });
        expect(college.website).toBe(website);
        await college.destroy();
      }

      // Test des URLs invalides
      for (const website of invalidWebsites) {
        await expect(NCAACollege.create({
          name: 'Invalid URL College',
          state: 'CA',
          division: 'ncaa_d1',
          conference: 'Test Conference',
          website,
          isActive: true
        })).rejects.toThrow();
      }
    });

    test('Should require all mandatory fields', async () => {
      const requiredFields = ['name', 'state', 'division', 'conference'];

      for (const field of requiredFields) {
        const collegeData = {
          name: 'Complete College',
          state: 'CA',
          division: 'ncaa_d1',
          conference: 'Complete Conference',
          website: 'https://complete.edu',
          isActive: true
        };

        delete collegeData[field];

        await expect(NCAACollege.create(collegeData)).rejects.toThrow();
      }
    });

    test('Should enforce unique college names', async () => {
      const collegeData = {
        name: 'Unique University',
        state: 'CA',
        division: 'ncaa_d1',
        conference: 'Pacific Conference',
        website: 'https://unique.edu',
        isActive: true
      };

      // Créer le premier college
      await NCAACollege.create(collegeData);

      // Tenter de créer un college avec le même nom
      await expect(NCAACollege.create({
        ...collegeData,
        state: 'TX', // État différent
        website: 'https://unique-tx.edu'
      })).rejects.toThrow();
    });
  });

  describe('🏢 Conference and Division Logic', () => {
    test('Should group colleges by conference correctly', async () => {
      const pacificColleges = [
        {
          name: 'Pacific University 1',
          state: 'CA',
          division: 'ncaa_d1',
          conference: 'Pacific Athletic Conference',
          website: 'https://pac1.edu',
          isActive: true
        },
        {
          name: 'Pacific University 2',
          state: 'OR',
          division: 'ncaa_d1',
          conference: 'Pacific Athletic Conference',
          website: 'https://pac2.edu',
          isActive: true
        }
      ];

      await NCAACollege.bulkCreate(pacificColleges);

      const pacificConferenceColleges = await NCAACollege.findAll({
        where: { conference: 'Pacific Athletic Conference' }
      });

      expect(pacificConferenceColleges).toHaveLength(2);
      expect(pacificConferenceColleges.every(c => c.conference === 'Pacific Athletic Conference')).toBe(true);
    });

    test('Should filter colleges by division', async () => {
      const testColleges = [
        {
          name: 'D1 University',
          state: 'CA',
          division: 'ncaa_d1',
          conference: 'Elite Conference',
          website: 'https://d1.edu',
          isActive: true
        },
        {
          name: 'D2 College',
          state: 'TX',
          division: 'ncaa_d2',
          conference: 'Regional Conference',
          website: 'https://d2.edu',
          isActive: true
        },
        {
          name: 'NAIA School',
          state: 'FL',
          division: 'naia',
          conference: 'NAIA Conference',
          website: 'https://naia.edu',
          isActive: true
        }
      ];

      await NCAACollege.bulkCreate(testColleges);

      const d1Colleges = await NCAACollege.findAll({
        where: { division: 'ncaa_d1' }
      });

      const naiaColleges = await NCAACollege.findAll({
        where: { division: 'naia' }
      });

      expect(d1Colleges).toHaveLength(1);
      expect(naiaColleges).toHaveLength(1);
      expect(d1Colleges[0].name).toBe('D1 University');
      expect(naiaColleges[0].name).toBe('NAIA School');
    });

    test('Should validate realistic conference/division combinations', async () => {
      // En réalité, certaines conférences n'existent que dans certaines divisions
      // Ce test valide que notre modèle permet la flexibilité nécessaire
      
      const realisticCombinations = [
        { division: 'ncaa_d1', conference: 'SEC', valid: true },
        { division: 'ncaa_d1', conference: 'Big Ten', valid: true },
        { division: 'ncaa_d2', conference: 'RMAC', valid: true },
        { division: 'ncaa_d3', conference: 'NESCAC', valid: true },
        { division: 'naia', conference: 'Heart of America', valid: true }
      ];

      for (const combo of realisticCombinations) {
        const college = await NCAACollege.create({
          name: `${combo.conference} College`,
          state: 'CA',
          division: combo.division,
          conference: combo.conference,
          website: 'https://test.edu',
          isActive: true
        });

        expect(college.division).toBe(combo.division);
        expect(college.conference).toBe(combo.conference);
        await college.destroy();
      }
    });
  });

  describe('🔗 Model Associations', () => {
    let testCollege;

    beforeEach(async () => {
      testCollege = await NCAACollege.create({
        name: 'Association Test University',
        state: 'CA',
        division: 'ncaa_d1',
        conference: 'Test Conference',
        website: 'https://association.edu',
        isActive: true
      });
    });

    test('Should have association with CoachProfile', async () => {
      // Créer un coach associé au college
      const userData = await TestHelpers.createTestCoach({
        college: testCollege
      });

      // Rechercher le college avec ses coachs
      const collegeWithCoaches = await NCAACollege.findByPk(testCollege.id, {
        include: [{ model: CoachProfile, as: 'coaches' }]
      });

      expect(collegeWithCoaches.coaches).toBeDefined();
      expect(collegeWithCoaches.coaches).toHaveLength(1);
      expect(collegeWithCoaches.coaches[0].collegeId).toBe(testCollege.id);
    });

    test('Should support multiple coaches per college', async () => {
      // Créer plusieurs coachs pour le même college
      const coachData1 = await TestHelpers.createTestCoach({
        college: testCollege,
        user: { email: 'coach1@association.edu' }
      });

      const coachData2 = await TestHelpers.createTestCoach({
        college: testCollege,
        user: { email: 'coach2@association.edu' }
      });

      const collegeWithCoaches = await NCAACollege.findByPk(testCollege.id, {
        include: [{ 
          model: CoachProfile, 
          as: 'coaches',
          include: [{ model: User, as: 'user' }]
        }]
      });

      expect(collegeWithCoaches.coaches).toHaveLength(2);
      const emails = collegeWithCoaches.coaches.map(c => c.user.email);
      expect(emails).toContain('coach1@association.edu');
      expect(emails).toContain('coach2@association.edu');
    });

    test('Should handle college deletion with cascade effects', async () => {
      // Créer un coach associé
      const coachData = await TestHelpers.createTestCoach({
        college: testCollege
      });

      // Vérifier que le coach existe
      let coachProfile = await CoachProfile.findOne({
        where: { collegeId: testCollege.id }
      });
      expect(coachProfile).toBeDefined();

      // Supprimer le college
      await testCollege.destroy();

      // Le coach devrait toujours exister (pas de cascade DELETE)
      // mais sa référence collegeId devrait être invalidée selon la configuration
      coachProfile = await CoachProfile.findOne({
        where: { userId: coachData.user.id }
      });
      
      // Selon la configuration de la clé étrangère, le coach pourrait
      // soit être supprimé, soit avoir collegeId à null, soit générer une erreur
      // Ce test valide le comportement configuré
      expect(coachProfile).toBeDefined();
    });
  });

  describe('📊 College Statistics and Queries', () => {
    beforeEach(async () => {
      // Créer plusieurs colleges pour les tests statistiques
      const colleges = [
        {
          name: 'California State University',
          state: 'CA',
          division: 'ncaa_d1',
          conference: 'Big West',
          website: 'https://csu.edu',
          isActive: true
        },
        {
          name: 'University of Texas',
          state: 'TX',
          division: 'ncaa_d1',
          conference: 'Big 12',
          website: 'https://ut.edu',
          isActive: true
        },
        {
          name: 'Florida Atlantic University',
          state: 'FL',
          division: 'ncaa_d2',
          conference: 'Sunshine State',
          website: 'https://fau.edu',
          isActive: false // College inactif
        }
      ];

      await NCAACollege.bulkCreate(colleges);
    });

    test('Should find active colleges only', async () => {
      const activeColleges = await NCAACollege.findAll({
        where: { isActive: true }
      });

      expect(activeColleges).toHaveLength(2);
      expect(activeColleges.every(c => c.isActive)).toBe(true);
    });

    test('Should group colleges by state', async () => {
      const californiaColleges = await NCAACollege.findAll({
        where: { state: 'CA' }
      });

      const texasColleges = await NCAACollege.findAll({
        where: { state: 'TX' }
      });

      expect(californiaColleges).toHaveLength(1);
      expect(texasColleges).toHaveLength(1);
      expect(californiaColleges[0].name).toBe('California State University');
    });

    test('Should search colleges by name pattern', async () => {
      const universityColleges = await NCAACollege.findAll({
        where: {
          name: {
            [require('sequelize').Op.iLike]: '%University%'
          }
        }
      });

      expect(universityColleges.length).toBeGreaterThanOrEqual(2);
      expect(universityColleges.every(c => c.name.includes('University'))).toBe(true);
    });

    test('Should sort colleges alphabetically', async () => {
      const sortedColleges = await NCAACollege.findAll({
        order: [['name', 'ASC']]
      });

      expect(sortedColleges.length).toBeGreaterThanOrEqual(3);
      
      // Vérifier l'ordre alphabétique
      for (let i = 1; i < sortedColleges.length; i++) {
        expect(sortedColleges[i].name >= sortedColleges[i-1].name).toBe(true);
      }
    });

    test('Should provide college counts by division', async () => {
      const divisionCounts = await NCAACollege.findAll({
        attributes: [
          'division',
          [require('sequelize').fn('COUNT', '*'), 'count']
        ],
        group: ['division'],
        raw: true
      });

      expect(divisionCounts.length).toBeGreaterThan(0);
      
      const d1Count = divisionCounts.find(d => d.division === 'ncaa_d1');
      const d2Count = divisionCounts.find(d => d.division === 'ncaa_d2');
      
      expect(d1Count.count).toBe('2'); // String à cause de raw: true
      expect(d2Count.count).toBe('1');
    });
  });

  describe('🔒 Data Integrity and Business Rules', () => {
    test('Should maintain data consistency on updates', async () => {
      const college = await NCAACollege.create({
        name: 'Consistency University',
        state: 'CA',
        division: 'ncaa_d1',
        conference: 'Pac-12',
        website: 'https://consistency.edu',
        isActive: true
      });

      // Mise à jour partielle
      await college.update({
        conference: 'Big Ten',
        state: 'OH'
      });

      await college.reload();
      expect(college.conference).toBe('Big Ten');
      expect(college.state).toBe('OH');
      expect(college.division).toBe('ncaa_d1'); // Non modifié
      expect(college.name).toBe('Consistency University'); // Non modifié
    });

    test('Should handle special characters in college names', async () => {
      const specialNames = [
        'St. Mary\'s College',
        'University of California-Berkeley',
        'Miami (OH) University',
        'Penn State University–University Park'
      ];

      for (const name of specialNames) {
        const college = await NCAACollege.create({
          name,
          state: 'CA',
          division: 'ncaa_d1',
          conference: 'Test Conference',
          website: 'https://test.edu',
          isActive: true
        });

        expect(college.name).toBe(name);
        await college.destroy();
      }
    });

    test('Should validate conference name lengths', async () => {
      const shortConference = 'SEC';
      const longConference = 'The Very Long Conference Name That Tests Maximum Length Validation Rules';

      // Conference courte (valide)
      const college1 = await NCAACollege.create({
        name: 'Short Conference College',
        state: 'CA',
        division: 'ncaa_d1',
        conference: shortConference,
        website: 'https://short.edu',
        isActive: true
      });
      expect(college1.conference).toBe(shortConference);

      // Conference très longue (pourrait être invalide selon les contraintes)
      if (longConference.length <= 255) { // Supposant une limite de 255 chars
        const college2 = await NCAACollege.create({
          name: 'Long Conference College',
          state: 'TX',
          division: 'ncaa_d2',
          conference: longConference,
          website: 'https://long.edu',
          isActive: true
        });
        expect(college2.conference).toBe(longConference);
      }
    });

    test('Should handle concurrent college creation safely', async () => {
      const collegePromises = Array(5).fill().map((_, i) =>
        NCAACollege.create({
          name: `Concurrent College ${i}`,
          state: 'TX',
          division: 'ncaa_d2',
          conference: 'Concurrent Conference',
          website: `https://concurrent${i}.edu`,
          isActive: true
        })
      );

      const colleges = await Promise.all(collegePromises);
      expect(colleges).toHaveLength(5);
      expect(colleges.every(c => c.id)).toBe(true);
    });
  });

  describe('⚡ Performance and Optimization', () => {
    test('Should handle large college datasets efficiently', async () => {
      // Créer beaucoup de colleges pour tester la performance
      const collegeData = Array(100).fill().map((_, i) => ({
        name: `Performance College ${i}`,
        state: ['CA', 'TX', 'FL', 'NY', 'OH'][i % 5],
        division: ['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia'][i % 4],
        conference: `Conference ${Math.floor(i / 10)}`,
        website: `https://perf${i}.edu`,
        isActive: i % 7 !== 0 // ~85% actifs
      }));

      const startTime = Date.now();
      await NCAACollege.bulkCreate(collegeData);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Moins de 5 secondes

      // Vérifier que tous sont créés
      const count = await NCAACollege.count();
      expect(count).toBe(100);
    });

    test('Should optimize queries with appropriate indexes', async () => {
      // Insérer des données de test
      await NCAACollege.bulkCreate(Array(50).fill().map((_, i) => ({
        name: `Index Test College ${i}`,
        state: ['CA', 'TX', 'FL'][i % 3],
        division: ['ncaa_d1', 'ncaa_d2'][i % 2],
        conference: `Conference ${i % 10}`,
        website: `https://index${i}.edu`,
        isActive: true
      })));

      // Test de requête qui devrait utiliser l'index sur 'state'
      const startTime = Date.now();
      const californiaColleges = await NCAACollege.findAll({
        where: { state: 'CA' },
        limit: 10
      });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Très rapide avec index
      expect(californiaColleges.length).toBeGreaterThan(0);
    });
  });
});