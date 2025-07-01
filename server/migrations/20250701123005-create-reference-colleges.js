// portall/server/migrations/20250701123005-create-reference-colleges.js

'use strict';

/**
 * Migration pour créer les tables de référence des colleges
 * 
 * Cette migration est la première car ces tables n'ont aucune dépendance.
 * Elles serviront de "dictionnaires" pour valider les choix des utilisateurs
 * lors de l'inscription.
 * 
 * Concepts clés :
 * - Tables de référence = données statiques qui changent rarement
 * - Index sur les colonnes de recherche fréquente (state, division)
 * - Contraintes de validation directement en base
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🏫 Creating reference tables for colleges...');

    // ========================
    // TABLE NJCAA_COLLEGES
    // ========================
    // Cette table stocke tous les community colleges NJCAA
    // où les joueurs peuvent être inscrits
    await queryInterface.createTable('njcaa_colleges', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'Identifiant unique du college NJCAA'
      },
      
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true, // Un seul college par nom
        comment: 'Nom officiel du college NJCAA'
      },
      
      state: {
        type: Sequelize.STRING(2),
        allowNull: false,
        comment: 'Code état sur 2 lettres (ex: CA, TX, FL)'
      },
      
      region: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'Région NJCAA (I, II, III, IV, etc.)'
      },
      
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Indique si le college accepte encore des inscriptions'
      },
      
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Date de création de l\'enregistrement'
      },
      
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Date de dernière modification'
      }
    });

    // ========================
    // TABLE NCAA_COLLEGES
    // ========================
    // Cette table stocke tous les colleges NCAA (D1, D2, D3) et NAIA
    // où les coachs peuvent travailler
    await queryInterface.createTable('ncaa_colleges', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'Identifiant unique du college NCAA/NAIA'
      },
      
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'Nom officiel du college NCAA/NAIA'
      },
      
      state: {
        type: Sequelize.STRING(2),
        allowNull: false,
        comment: 'Code état sur 2 lettres'
      },
      
      division: {
        type: Sequelize.ENUM('ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia'),
        allowNull: false,
        comment: 'Division du college (NCAA D1/D2/D3 ou NAIA)'
      },
      
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Indique si le college est actif dans le système'
      },
      
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // ========================
    // INDEX POUR PERFORMANCES
    // ========================
    // Ces index accélèrent les requêtes les plus fréquentes
    
    console.log('📊 Creating indexes for NJCAA colleges...');
    
    // Index sur l'état pour filtrer par région géographique
    await queryInterface.addIndex('njcaa_colleges', {
      fields: ['state'],
      name: 'idx_njcaa_colleges_state',
      comment: 'Accélère les recherches par état'
    });
    
    // Index sur la région NJCAA
    await queryInterface.addIndex('njcaa_colleges', {
      fields: ['region'],
      name: 'idx_njcaa_colleges_region',
      comment: 'Accélère les recherches par région NJCAA'
    });
    
    // Index sur le statut actif pour filtrer les colleges disponibles
    await queryInterface.addIndex('njcaa_colleges', {
      fields: ['is_active'],
      name: 'idx_njcaa_colleges_active',
      comment: 'Accélère les recherches de colleges actifs'
    });
    
    // Index composite pour les recherches complexes (état + actif)
    await queryInterface.addIndex('njcaa_colleges', {
      fields: ['state', 'is_active'],
      name: 'idx_njcaa_colleges_state_active',
      comment: 'Accélère les recherches par état parmi les colleges actifs'
    });

    console.log('📊 Creating indexes for NCAA colleges...');
    
    // Index sur l'état
    await queryInterface.addIndex('ncaa_colleges', {
      fields: ['state'],
      name: 'idx_ncaa_colleges_state'
    });
    
    // Index sur la division (très important pour les recherches de coachs)
    await queryInterface.addIndex('ncaa_colleges', {
      fields: ['division'],
      name: 'idx_ncaa_colleges_division',
      comment: 'Crucial pour filtrer par niveau NCAA/NAIA'
    });
    
    // Index sur le statut actif
    await queryInterface.addIndex('ncaa_colleges', {
      fields: ['is_active'],
      name: 'idx_ncaa_colleges_active'
    });
    
    // Index composite division + actif (requête très fréquente)
    await queryInterface.addIndex('ncaa_colleges', {
      fields: ['division', 'is_active'],
      name: 'idx_ncaa_colleges_division_active',
      comment: 'Optimise les dropdowns de sélection par division'
    });

    console.log('✅ Reference tables created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Dropping reference tables...');
    
    // Supprimer les tables dans l'ordre inverse pour éviter les erreurs
    await queryInterface.dropTable('ncaa_colleges');
    await queryInterface.dropTable('njcaa_colleges');
    
    console.log('✅ Reference tables dropped');
  }
};