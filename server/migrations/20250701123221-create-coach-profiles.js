// portall/server/migrations/20250701123221-create-coach-profiles.js

'use strict';

/**
 * Migration pour créer la table des profils coachs
 * 
 * Cette table stocke les informations spécifiques aux coachs NCAA/NAIA.
 * Elle établit des relations avec users (1:1) et ncaa_colleges (N:1).
 * 
 * Concepts métier spécifiques aux coachs :
 * - Position hiérarchique (head coach vs assistant coach)
 * - Division et sport spécifiques (NCAA D1 men's soccer, etc.)
 * - Historique des recherches et favoris (métier du recrutement)
 * - Contact professionnel (numéro de téléphone pour le recrutement)
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🏟️ Creating coach profiles table...');

    await queryInterface.createTable('coach_profiles', {
      // ========================
      // IDENTIFIANTS ET RELATIONS
      // ========================
      
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'Identifiant unique du profil coach'
      },

      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true, // Un utilisateur = un seul profil coach maximum
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
          model: 'ncaa_colleges', // Référence vers les colleges NCAA/NAIA
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT', // Empêche la suppression d'un college utilisé
        comment: 'College NCAA/NAIA où le coach travaille'
      },

      // ========================
      // INFORMATIONS PROFESSIONNELLES
      // ========================
      
      position: {
        type: Sequelize.ENUM('head_coach', 'assistant_coach'),
        allowNull: false,
        comment: 'Position hiérarchique du coach dans l\'équipe'
      },

      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Numéro de téléphone professionnel pour le recrutement'
      },

      division: {
        type: Sequelize.ENUM('ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia'),
        allowNull: false,
        comment: 'Division du college (doit correspondre au college sélectionné)'
      },

      team_sport: {
        type: Sequelize.ENUM('mens_soccer', 'womens_soccer'),
        allowNull: false,
        comment: 'Équipe dirigée (masculine ou féminine)'
      },

      // ========================
      // FONCTIONNALITÉS MÉTIER AVANCÉES
      // ========================
      
      saved_searches: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
        comment: 'Recherches sauvegardées du coach (critères, filtres, etc.)'
      },

      total_searches: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Nombre total de recherches effectuées (analytics)'
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
    
    console.log('📊 Creating indexes for coach profiles...');

    // Index sur user_id (relation 1:1)
    await queryInterface.addIndex('coach_profiles', {
      fields: ['user_id'],
      unique: true,
      name: 'idx_coach_profiles_user_id',
      comment: 'Garantit et accélère la relation 1:1 avec users'
    });

    // Index sur college_id (pour retrouver les coachs d'un college)
    await queryInterface.addIndex('coach_profiles', {
      fields: ['college_id'],
      name: 'idx_coach_profiles_college_id',
      comment: 'Accélère les recherches de coachs par college'
    });

    // Index sur la division (très important pour segmenter les recherches)
    await queryInterface.addIndex('coach_profiles', {
      fields: ['division'],
      name: 'idx_coach_profiles_division',
      comment: 'Accélère les recherches par niveau (D1, D2, D3, NAIA)'
    });

    // Index sur le sport de l'équipe (pour la correspondance de genre)
    await queryInterface.addIndex('coach_profiles', {
      fields: ['team_sport'],
      name: 'idx_coach_profiles_team_sport',
      comment: 'Accélère les recherches par genre d\'équipe'
    });

    // Index sur la position (pour différencier head coachs et assistants)
    await queryInterface.addIndex('coach_profiles', {
      fields: ['position'],
      name: 'idx_coach_profiles_position',
      comment: 'Accélère les recherches par position'
    });

    // Index composite crucial : division + team_sport
    // Optimise la requête : "Tous les coachs NCAA D1 masculin"
    await queryInterface.addIndex('coach_profiles', {
      fields: ['division', 'team_sport'],
      name: 'idx_coach_profiles_division_sport',
      comment: 'Optimise les recherches par division et genre d\'équipe'
    });

    // Index composite pour la correspondance parfaite : division + sport + position
    // Optimise : "Tous les head coachs NCAA D1 féminin"
    await queryInterface.addIndex('coach_profiles', {
      fields: ['division', 'team_sport', 'position'],
      name: 'idx_coach_profiles_full_match',
      comment: 'Optimise les recherches complètes de correspondance'
    });

    console.log('✅ Coach profiles table created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Dropping coach profiles table...');
    await queryInterface.dropTable('coach_profiles');
    console.log('✅ Coach profiles table dropped');
  }
};