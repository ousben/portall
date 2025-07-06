// portall/server/migrations/20250706000002-create-njcaa-coach-profiles.js

'use strict';

/**
 * Migration pour créer la table des profils coachs NJCAA
 * 
 * Cette table stocke les informations spécifiques aux coachs NJCAA.
 * Elle établit des relations avec users (1:1) et njcaa_colleges (N:1).
 * 
 * Différences importantes avec les coachs NCAA/NAIA :
 * - Utilisent les colleges NJCAA (pas NCAA)
 * - Divisions NJCAA spécifiques (D1, D2, D3)
 * - Rôle d'évaluation des joueurs (pas de recherche payante)
 * - Pas d'abonnement Stripe
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🏟️ Creating NJCAA coach profiles table...');

    await queryInterface.createTable('njcaa_coach_profiles', {
      // ========================
      // IDENTIFIANTS ET RELATIONS
      // ========================
      
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'Identifiant unique du profil coach NJCAA'
      },

      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true, // Un utilisateur = un seul profil coach NJCAA maximum
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Référence vers l\'utilisateur propriétaire de ce profil'
      },

      college_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'njcaa_colleges', // Référence vers les colleges NJCAA (pas NCAA)
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT', // Empêche la suppression d'un college utilisé
        comment: 'College NJCAA où le coach travaille'
      },

      // ========================
      // INFORMATIONS PROFESSIONNELLES SPÉCIFIQUES NJCAA
      // ========================
      
      position: {
        type: Sequelize.ENUM('head_coach', 'assistant_coach'),
        allowNull: false,
        comment: 'Position hiérarchique du coach dans l\'équipe'
      },

      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Numéro de téléphone professionnel'
      },

      division: {
        type: Sequelize.ENUM('njcaa_d1', 'njcaa_d2', 'njcaa_d3'),
        allowNull: false,
        comment: 'Division NJCAA du college (différent des divisions NCAA/NAIA)'
      },

      team_sport: {
        type: Sequelize.ENUM('mens_soccer', 'womens_soccer'),
        allowNull: false,
        comment: 'Équipe dirigée (masculine ou féminine)'
      },

      // ========================
      // FONCTIONNALITÉS SPÉCIFIQUES ÉVALUATION
      // ========================
      
      total_evaluations: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Nombre total d\'évaluations de joueurs effectuées'
      },

      last_evaluation_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date de la dernière évaluation effectuée'
      },

      // ========================
      // MÉTADONNÉES SYSTÈME
      // ========================
      
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Date de création du profil'
      },

      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Date de dernière modification'
      }
    });

    // ========================
    // INDEX POUR OPTIMISER LES RECHERCHES
    // ========================
    
    console.log('📊 Creating indexes for NJCAA coach profiles...');

    // Index sur user_id (relation 1:1)
    await queryInterface.addIndex('njcaa_coach_profiles', {
      fields: ['user_id'],
      unique: true,
      name: 'idx_njcaa_coach_profiles_user_id',
      comment: 'Garantit et accélère la relation 1:1 avec users'
    });

    // Index sur college_id (pour retrouver les coachs d'un college)
    await queryInterface.addIndex('njcaa_coach_profiles', {
      fields: ['college_id'],
      name: 'idx_njcaa_coach_profiles_college_id',
      comment: 'Accélère les recherches de coachs par college NJCAA'
    });

    // Index sur la division (important pour segmenter les recherches)
    await queryInterface.addIndex('njcaa_coach_profiles', {
      fields: ['division'],
      name: 'idx_njcaa_coach_profiles_division',
      comment: 'Accélère les recherches par niveau NJCAA (D1, D2, D3)'
    });

    // Index sur le sport de l'équipe (pour la correspondance de genre)
    await queryInterface.addIndex('njcaa_coach_profiles', {
      fields: ['team_sport'],
      name: 'idx_njcaa_coach_profiles_team_sport',
      comment: 'Accélère les recherches par genre d\'équipe'
    });

    // Index composite crucial : college + team_sport
    // Optimise la requête principale : "Tous les joueurs de mon college et de mon genre"
    await queryInterface.addIndex('njcaa_coach_profiles', {
      fields: ['college_id', 'team_sport'],
      name: 'idx_njcaa_coach_profiles_college_sport',
      comment: 'Optimise la recherche des joueurs du même college et sport'
    });

    console.log('✅ NJCAA coach profiles table created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Dropping NJCAA coach profiles table...');
    await queryInterface.dropTable('njcaa_coach_profiles');
    console.log('✅ NJCAA coach profiles table dropped');
  }
};