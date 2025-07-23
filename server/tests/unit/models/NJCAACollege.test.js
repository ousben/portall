// portall/server/tests/unit/models/NJCAACollege.test.js

process.env.NODE_ENV = 'test';

const { NJCAACollege, PlayerProfile, NJCAACoachProfile, User } = require('../../../models');
const TestHelpers = require('../../utils/testHelpers');

/**
 * 🏫 Tests unitaires du modèle NJCAACollege - Institutions Sources de Talents
 * 
 * Le modèle NJCAACollege représente les institutions qui forment vos talents sources.
 * Contrairement aux colleges NCAA/NAIA (clients), les colleges NJCAA sont vos
 * fournisseurs de joueurs - ils constituent l'écosystème d'où proviennent les talents
 * que vos coachs clients NCAA/NAIA cherchent à recruter.
 * 
 * 🎯 Concept pédagogique : "Source Institution Testing"
 * Les institutions sources ont des caractéristiques différentes des institutions
 * clientes. Elles sont organisées par régions NJCAA plutôt que par conférences,
 * et utilisent un système de divisions propre (D1/D2/D3 NJCAA ≠ NCAA).
 * 
 * 💡 Différences architecturales testées :
 * - Système de régions NJCAA vs conférences NCAA
 * - Divisions NJCAA (njcaa_d1/d2/d3) vs NCAA (ncaa_d1/d2/d3)
 * - Relations avec PlayerProfile et NJCAACoachProfile (pas CoachProfile)
 * - Logique de distribution géographique par régions
 * 
 * 🔧 Impact métier :
 * Ces colleges déterminent la répartition géographique de vos talents et
 * influencent les stratégies de recrutement régional de vos clients coachs.
 */

describe('🏫 NJCAACollege Model - Source Talent Institution Testing', () => {

  beforeEach(async () => {
    await TestHelpers.cleanupTestData();
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('✅ Institution Data Validations', () => {
    test('Should create valid NJCAA college with all required fields', async () => {
      const collegeData = {
        name: 'Excellence Community College',
        state: 'CA',
        region: 'West',
        division: 'njcaa_d1',
        website: 'https://www.excellence-cc.edu',
        isActive: true
      };

      const college = await NJCAACollege.create(collegeData);

      expect(college.id).toBeDefined();
      expect(college.name).toBe('Excellence Community College');
      expect(college.state).toBe('CA');
      expect(college.region).toBe('West');
      expect(college.division).toBe('njcaa_d1');  
      expect(college.website).toBe('https://www.excellence-cc.edu');
      expect(college.isActive).toBe(true);
      expect(college.createdAt).toBeInstanceOf(Date);
    });

    test('Should validate NJCAA divisions correctly', async () => {
      const validDivisions = ['njcaa_d1', 'njcaa_d2', 'njcaa_d3'];
      const invalidDivisions = ['ncaa_d1', 'naia', 'high_school', 'division_1'];

      // Test des divisions valides NJCAA
      for (const division of validDivisions) {
        const college = await NJCAACollege.create({
          name: `Test NJCAA College ${division}`,
          state: 'TX',
          region: 'South',
          division,
          website: 'https://test-njcaa.edu',
          isActive: true
        });
        expect(college.division).toBe(division);
        await college.destroy();
      }

      // Test des divisions invalides
      for (const division of invalidDivisions) {
        await expect(NJCAACollege.create({
          name: 'Invalid NJCAA College',
          state: 'FL',
          region: 'South',
          division,
          website: 'https://invalid-njcaa.edu',
          isActive: true
        })).rejects.toThrow();
      }
    });

    test('Should validate NJCAA regions correctly', async () => {
      const validRegions = ['North', 'South', 'East', 'West', 'Midwest', 'Northeast', 'Southeast', 'Southwest'];
      const invalidRegions = ['Pacific', 'Atlantic', 'Mountain', 'Central'];

      // Test des régions valides NJCAA
      for (const region of validRegions) {
        const college = await NJCAACollege.create({
          name: `${region} Regional College`,
          state: 'CA',
          region,
          division: 'njcaa_d1',
          website: 'https://regional.edu',
          isActive: true
        });
        expect(college.region).toBe(region);
        await college.destroy();
      }

      // Test des régions invalides
      for (const region of invalidRegions) {
        await expect(NJCAACollege.create({
          name: 'Invalid Regional College',
          state: 'CA',
          region,
          division: 'njcaa_d1',
          website: 'https://invalid.edu',
          isActive: true
        })).rejects.toThrow();
      }
    });

    test('Should require all mandatory fields', async () => {
      const requiredFields = ['name', 'state', 'region', 'division'];

      for (const field of requiredFields) {
        const collegeData = {
          name: 'Complete NJCAA College',
          state: 'CA',
          region: 'West',
          division: 'njcaa_d1',
          website: 'https://complete-njcaa.edu',
          isActive: true
        };

        delete collegeData[field];

        await expect(NJCAACollege.create(collegeData)).rejects.toThrow();
      }
    });

    test('Should enforce unique college names', async () => {
      const collegeData = {
        name: 'Unique NJCAA College',
        state: 'CA',
        region: 'West',
        division: 'njcaa_d1',
        website: 'https://unique-njcaa.edu',
        isActive: true
      };

      // Créer le premier college
      await NJCAACollege.create(collegeData);

      // Tenter de créer un college avec le même nom
      await expect(NJCAACollege.create({
        ...collegeData,
        state: 'TX', // État différent
        region: 'South', // Région différente
        website: 'https://unique-njcaa-tx.edu'
      })).rejects.toThrow();
    });
  });

  describe('🗺️ Regional Distribution Logic', () => {
    test('Should group colleges by region correctly', async () => {
      const westColleges = [
        {
          name: 'California Community College',
          state: 'CA',
          region: 'West',
          division: 'njcaa_d1',
          website: 'https://ca-cc.edu',
          isActive: true
        },
        {
          name: 'Oregon Community College',
          state: 'OR',
          region: 'West',
          division: 'njcaa_d2',
          website: 'https://or-cc.edu',
          isActive: true
        }
      ];

      await NJCAACollege.bulkCreate(westColleges);

      const westRegionColleges = await NJCAACollege.findAll({
        where: { region: 'West' }
      });

      expect(westRegionColleges).toHaveLength(2);
      expect(westRegionColleges.every(c => c.region === 'West')).toBe(true);
    });

    test('Should filter colleges by division within regions', async () => {
      const southernColleges = [
        {
          name: 'Texas D1 College',
          state: 'TX',
          region: 'South',
          division: 'njcaa_d1',
          website: 'https://tx-d1.edu',
          isActive: true
        },
        {
          name: 'Florida D2 College',
          state: 'FL',
          region: 'South',
          division: 'njcaa_d2',
          website: 'https://fl-d2.edu',
          isActive: true
        },
        {
          name: 'Georgia D1 College',
          state: 'GA',
          region: 'South',
          division: 'njcaa_d1',
          website: 'https://ga-d1.edu',
          isActive: true
        }
      ];

      await NJCAACollege.bulkCreate(southernColleges);

      const southD1Colleges = await NJCAACollege.findAll({
        where: { 
          region: 'South',
          division: 'njcaa_d1'
        }
      });

      const southD2Colleges = await NJCAACollege.findAll({
        where: { 
          region: 'South',
          division: 'njcaa_d2'
        }
      });

      expect(southD1Colleges).toHaveLength(2);
      expect(southD2Colleges).toHaveLength(1);
      expect(southD1Colleges.every(c => c.division === 'njcaa_d1')).toBe(true);
      expect(southD2Colleges[0].name).toBe('Florida D2 College');
    });

    test('Should validate realistic region/state combinations', async () => {
      // Tester des associations région/état réalistes
      const realisticCombinations = [
        { region: 'West', state: 'CA', valid: true },
        { region: 'West', state: 'OR', valid: true },
        { region: 'South', state: 'TX', valid: true },
        { region: 'South', state: 'FL', valid: true },
        { region: 'Midwest', state: 'IL', valid: true },
        { region: 'Northeast', state: 'NY', valid: true }
      ];

      for (const combo of realisticCombinations) {
        const college = await NJCAACollege.create({
          name: `${combo.state} ${combo.region} College`,
          state: combo.state,
          region: combo.region,
          division: 'njcaa_d1',
          website: 'https://test.edu',
          isActive: true
        });

        expect(college.region).toBe(combo.region);
        expect(college.state).toBe(combo.state);
        await college.destroy();
      }
    });
  });

  describe('🔗 Model Associations', () => {
    let testCollege;

    beforeEach(async () => {
      testCollege = await NJCAACollege.create({
        name: 'Association Test College',
        state: 'CA',
        region: 'West',
        division: 'njcaa_d1',
        website: 'https://association-test.edu',
        isActive: true
      });
    });

    test('Should have association with PlayerProfile', async () => {
      // Créer un utilisateur et un profil joueur
      const testUser = await User.create({
        email: 'player.association@example.com',
        password: 'TestPassword123!',
        firstName: 'Player',
        lastName: 'Association',
        userType: 'player'
      });

      const playerProfile = await PlayerProfile.create({
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

      // Tester l'association
      const collegeWithPlayers = await NJCAACollege.findByPk(testCollege.id, {
        include: [{ model: PlayerProfile, as: 'players' }]
      });

      expect(collegeWithPlayers.players).toHaveLength(1);
      expect(collegeWithPlayers.players[0].id).toBe(playerProfile.id);
      expect(collegeWithPlayers.players[0].position).toBe('midfielder');
    });

    test('Should have association with NJCAACoachProfile', async () => {
      // Créer un utilisateur et un profil coach NJCAA
      const testUser = await User.create({
        email: 'njcaa.coach.association@example.com',
        password: 'TestPassword123!',
        firstName: 'NJCAA',
        lastName: 'Coach',
        userType: 'njcaa_coach'
      });

      const coachProfile = await NJCAACoachProfile.create({
        userId: testUser.id,
        position: 'head_coach',
        phoneNumber: '+1234567890',
        collegeId: testCollege.id,
        division: 'njcaa_d1',
        teamSport: 'mens_soccer'
      });

      // Tester l'association
      const collegeWithCoaches = await NJCAACollege.findByPk(testCollege.id, {
        include: [{ model: NJCAACoachProfile, as: 'njcaaCoaches' }]
      });

      expect(collegeWithCoaches.njcaaCoaches).toHaveLength(1);
      expect(collegeWithCoaches.njcaaCoaches[0].id).toBe(coachProfile.id);
      expect(collegeWithCoaches.njcaaCoaches[0].position).toBe('head_coach');
    });

    test('Should load complete college data with all associations', async () => {
      // Créer des données de test complètes
      const playerUser = await User.create({
        email: 'complete.player@example.com',
        password: 'TestPassword123!',
        firstName: 'Complete',
        lastName: 'Player',
        userType: 'player'
      });

      const coachUser = await User.create({
        email: 'complete.coach@example.com',
        password: 'TestPassword123!',
        firstName: 'Complete',
        lastName: 'Coach',
        userType: 'njcaa_coach'
      });

      await PlayerProfile.create({
        userId: playerUser.id,
        dateOfBirth: new Date('2003-01-01'),
        height: 180,
        weight: 75,
        position: 'forward',
        gender: 'male',
        collegeId: testCollege.id,
        currentYear: 'sophomore',
        graduationYear: 2025
      });

      await NJCAACoachProfile.create({
        userId: coachUser.id,
        position: 'assistant_coach',
        phoneNumber: '+1987654321',
        collegeId: testCollege.id,
        division: 'njcaa_d1',
        teamSport: 'womens_soccer'
      });

      // Charger toutes les associations
      const completeCollege = await NJCAACollege.findByPk(testCollege.id, {
        include: [
          { 
            model: PlayerProfile, 
            as: 'players',
            include: [{ model: User, as: 'user' }]
          },
          { 
            model: NJCAACoachProfile, 
            as: 'njcaaCoaches',
            include: [{ model: User, as: 'user' }]
          }
        ]
      });

      expect(completeCollege.players).toHaveLength(1);
      expect(completeCollege.njcaaCoaches).toHaveLength(1);
      expect(completeCollege.players[0].user.firstName).toBe('Complete');
      expect(completeCollege.njcaaCoaches[0].user.firstName).toBe('Complete');
    });
  });

  describe('🎯 Business Logic Methods', () => {
    let testCollege;

    beforeEach(async () => {
      testCollege = await NJCAACollege.create({
        name: 'Business Logic Test College',
        state: 'TX',
        region: 'South',
        division: 'njcaa_d1',
        website: 'https://business-test.edu',
        isActive: true
      });
    });

    test('Should track active status correctly', async () => {
      expect(testCollege.isActive).toBe(true);

      // Désactiver le college
      await testCollege.update({ isActive: false });
      expect(testCollege.isActive).toBe(false);

      // Vérifier le filtrage par statut actif
      const activeColleges = await NJCAACollege.findAll({
        where: { isActive: true }
      });

      const inactiveColleges = await NJCAACollege.findAll({
        where: { isActive: false }
      });

      expect(activeColleges.find(c => c.id === testCollege.id)).toBeUndefined();
      expect(inactiveColleges.find(c => c.id === testCollege.id)).toBeDefined();
    });

    test('Should support search by multiple criteria', async () => {
      // Créer des colleges supplémentaires pour les recherches
      await NJCAACollege.bulkCreate([
        {
          name: 'California West D1',
          state: 'CA',
          region: 'West',
          division: 'njcaa_d1',
          website: 'https://ca-west-d1.edu',
          isActive: true
        },
        {
          name: 'California West D2',
          state: 'CA',
          region: 'West',
          division: 'njcaa_d2',
          website: 'https://ca-west-d2.edu',
          isActive: true
        },
        {
          name: 'Texas South D1',
          state: 'TX',
          region: 'South',
          division: 'njcaa_d1',
          website: 'https://tx-south-d1.edu',
          isActive: true
        }
      ]);

      // Recherche par état et région
      const caWestColleges = await NJCAACollege.findAll({
        where: {
          state: 'CA',
          region: 'West',
          isActive: true
        }
      });

      // Recherche par division et statut
      const d1ActiveColleges = await NJCAACollege.findAll({
        where: {
          division: 'njcaa_d1',
          isActive: true
        }
      });

      expect(caWestColleges).toHaveLength(2);
      expect(d1ActiveColleges).toHaveLength(3); // testCollege + CA + TX
      expect(d1ActiveColleges.every(c => c.division === 'njcaa_d1')).toBe(true);
    });
  });

  describe('📊 Data Serialization and Privacy', () => {
    test('Should serialize public data correctly', async () => {
      const college = await NJCAACollege.create({
        name: 'Serialization Test College',
        state: 'FL',
        region: 'South',
        division: 'njcaa_d2',
        website: 'https://serialization-test.edu',
        isActive: true
      });

      const publicData = college.toJSON();

      // Vérifier que toutes les données nécessaires sont présentes
      expect(publicData).toHaveProperty('id');
      expect(publicData).toHaveProperty('name', 'Serialization Test College');
      expect(publicData).toHaveProperty('state', 'FL');
      expect(publicData).toHaveProperty('region', 'South');
      expect(publicData).toHaveProperty('division', 'njcaa_d2');
      expect(publicData).toHaveProperty('website', 'https://serialization-test.edu');
      expect(publicData).toHaveProperty('isActive', true);
      expect(publicData).toHaveProperty('createdAt');
      expect(publicData).toHaveProperty('updatedAt');

      // Pour les colleges NJCAA, toutes les données sont publiques
      // (contrairement aux profils utilisateurs qui ont des données sensibles)
    });
  });

  describe('🏆 Performance and Optimization', () => {
    test('Should handle bulk operations efficiently', async () => {
      const bulkColleges = Array.from({ length: 50 }, (_, index) => ({
        name: `Bulk Test College ${index + 1}`,
        state: index % 2 === 0 ? 'CA' : 'TX',
        region: index % 2 === 0 ? 'West' : 'South',
        division: ['njcaa_d1', 'njcaa_d2', 'njcaa_d3'][index % 3],
        website: `https://bulk-test-${index + 1}.edu`,
        isActive: true
      }));

      const startTime = Date.now();
      await NJCAACollege.bulkCreate(bulkColleges);
      const endTime = Date.now();

      const createdColleges = await NJCAACollege.findAll({
        where: {
          name: {
            [require('sequelize').Op.like]: 'Bulk Test College%'
          }
        }
      });

      expect(createdColleges).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(5000); // Moins de 5 secondes
    });

    test('Should optimize queries with proper indexing', async () => {
      // Créer des données de test pour mesurer les performances
      await NJCAACollege.bulkCreate(Array.from({ length: 100 }, (_, index) => ({
        name: `Performance Test ${index}`,
        state: ['CA', 'TX', 'FL', 'NY'][index % 4],
        region: ['West', 'South', 'East', 'Northeast'][index % 4],
        division: ['njcaa_d1', 'njcaa_d2', 'njcaa_d3'][index % 3],
        website: `https://performance-${index}.edu`,
        isActive: index % 10 !== 0 // 90% actifs
      })));

      // Test de requêtes optimisées courantes
      const startTime = Date.now();
      
      const byRegion = await NJCAACollege.findAll({
        where: { region: 'West', isActive: true }
      });
      
      const byDivision = await NJCAACollege.findAll({
        where: { division: 'njcaa_d1', isActive: true }
      });
      
      const byState = await NJCAACollege.findAll({
        where: { state: 'CA', isActive: true }
      });
      
      const endTime = Date.now();

      expect(byRegion.length).toBeGreaterThan(0);
      expect(byDivision.length).toBeGreaterThan(0);
      expect(byState.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000); // Moins d'1 seconde
    });
  });
});