// portall/server/migrations/20250701123534-seed-demo-data.js

'use strict';

/**
 * Migration pour peupler les tables de référence avec des données de démonstration
 * 
 * Cette migration est optionnelle mais très utile pour le développement.
 * Elle insère des colleges NJCAA et NCAA réalistes pour permettre
 * de tester les formulaires d'inscription sans attendre d'avoir
 * toutes les vraies données.
 * 
 * En production, tu remplacerais cette migration par une importation
 * de données réelles depuis les sites officiels NJCAA et NCAA.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🌱 Seeding demo data for development...');

    // ========================
    // COLLEGES NJCAA DE DÉMONSTRATION
    // ========================
    
    console.log('📚 Inserting demo NJCAA colleges...');
    
    await queryInterface.bulkInsert('njcaa_colleges', [
      // Californie - Région très active en soccer
      {
        name: 'Fresno City College',
        state: 'CA',
        region: 'III',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Los Angeles Pierce College',
        state: 'CA',
        region: 'III',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'San Diego Mesa College',
        state: 'CA',
        region: 'III',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Texas - Autre état très fort en soccer
      {
        name: 'Tyler Junior College',
        state: 'TX',
        region: 'V',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Richland College',
        state: 'TX',
        region: 'V',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Floride - État traditionnel du soccer
      {
        name: 'Broward College',
        state: 'FL',
        region: 'VIII',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Miami Dade College',
        state: 'FL',
        region: 'VIII',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // New York - Représentation de la côte est
      {
        name: 'Nassau Community College',
        state: 'NY',
        region: 'III',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Illinois - Midwest
      {
        name: 'Harper College',
        state: 'IL',
        region: 'IV',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Un college inactif pour tester la fonctionnalité
      {
        name: 'Inactive Demo College',
        state: 'XX',
        region: 'Test',
        is_active: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // ========================
    // COLLEGES NCAA DE DÉMONSTRATION
    // ========================
    
    console.log('🏛️ Inserting demo NCAA colleges...');
    
    await queryInterface.bulkInsert('ncaa_colleges', [
      // NCAA DIVISION 1 - Élite du soccer universitaire
      {
        name: 'Stanford University',
        state: 'CA',
        division: 'ncaa_d1',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'University of North Carolina',
        state: 'NC',
        division: 'ncaa_d1',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'University of Virginia',
        state: 'VA',
        division: 'ncaa_d1',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'UCLA',
        state: 'CA',
        division: 'ncaa_d1',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // NCAA DIVISION 2 - Excellent niveau avec équilibre academics/athletics
      {
        name: 'Cal State Los Angeles',
        state: 'CA',
        division: 'ncaa_d2',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Nova Southeastern University',
        state: 'FL',
        division: 'ncaa_d2',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Lynn University',
        state: 'FL',
        division: 'ncaa_d2',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // NCAA DIVISION 3 - Focus sur l'expérience étudiante
      {
        name: 'Williams College',
        state: 'MA',
        division: 'ncaa_d3',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Middlebury College',
        state: 'VT',
        division: 'ncaa_d3',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'University of Chicago',
        state: 'IL',
        division: 'ncaa_d3',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // NAIA - Alternative à la NCAA
      {
        name: 'Keiser University',
        state: 'FL',
        division: 'naia',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Oklahoma Christian University',
        state: 'OK',
        division: 'naia',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Lindsey Wilson College',
        state: 'KY',
        division: 'naia',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Un college inactif pour tester
      {
        name: 'Inactive NCAA Demo',
        state: 'XX',
        division: 'ncaa_d1',
        is_active: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    console.log('✅ Demo data seeded successfully');
    console.log('📊 Summary:');
    console.log('   - NJCAA Colleges: 10 (9 active, 1 inactive)');
    console.log('   - NCAA Colleges: 14 (13 active, 1 inactive)');
    console.log('   - Geographic coverage: CA, TX, FL, NY, IL, NC, VA, MA, VT, OK, KY');
    console.log('   - All divisions represented: D1, D2, D3, NAIA');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Removing demo data...');
    
    // Supprimer toutes les données de demo
    await queryInterface.bulkDelete('ncaa_colleges', {
      name: {
        [Sequelize.Op.like]: '%Demo%'
      }
    });
    
    await queryInterface.bulkDelete('njcaa_colleges', {
      name: {
        [Sequelize.Op.like]: '%Demo%'
      }
    });
    
    // Supprimer les vraies données aussi (attention en production !)
    await queryInterface.bulkDelete('ncaa_colleges', null);
    await queryInterface.bulkDelete('njcaa_colleges', null);
    
    console.log('✅ Demo data removed');
  }
};