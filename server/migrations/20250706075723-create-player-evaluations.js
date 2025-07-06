// portall/server/migrations/20250706000003-create-player-evaluations.js

'use strict';

/**
 * Migration pour créer la table des évaluations de joueurs
 * 
 * Cette table stocke les évaluations objectives des joueurs NJCAA
 * effectuées par leurs coachs. Ces évaluations servent aux coachs
 * NCAA/NAIA pour le recrutement.
 * 
 * Logique métier :
 * - Un coach NJCAA peut évaluer ses joueurs
 * - Une évaluation = ensemble de critères objectifs + commentaires
 * - Les évaluations sont visibles aux coachs NCAA/NAIA recruteurs
 * - Historique des évaluations conservé (versioning)
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('📝 Creating player evaluations table...');

    await queryInterface.createTable('player_evaluations', {
      // ========================
      // IDENTIFIANTS ET RELATIONS
      // ========================
      
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'Identifiant unique de l\'évaluation'
      },

      player_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'player_profiles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Joueur évalué'
      },

      coach_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'njcaa_coach_profiles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Coach NJCAA qui effectue l\'évaluation'
      },

      // ========================
      // CRITÈRES D'ÉVALUATION SELON SPÉCIFICATIONS
      // ========================
      
      available_to_transfer: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        comment: 'Le joueur est-il disponible pour un transfert ?'
      },

      role_in_team: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Rôle du joueur dans l\'équipe'
      },

      expected_graduation_date: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 2024,
          max: 2030
        },
        comment: 'Année de diplôme prévue'
      },

      performance_level: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'À quel niveau le coach pense que le joueur peut performer'
      },

      player_strengths: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Points forts du joueur'
      },

      improvement_areas: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Domaines à améliorer'
      },

      mentality: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Évaluation de la mentalité du joueur'
      },

      coachability: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Capacité du joueur à être coaché'
      },

      technique: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Évaluation technique du joueur'
      },

      physique: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Évaluation physique du joueur'
      },

      coach_final_comment: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Commentaire final du coach'
      },

      // ========================
      // MÉTADONNÉES D'ÉVALUATION
      // ========================
      
      evaluation_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Version de l\'évaluation (pour historique)'
      },

      is_current: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Cette évaluation est-elle la plus récente ?'
      },

      evaluation_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Date de création de l\'évaluation'
      },

      // ========================
      // MÉTADONNÉES SYSTÈME
      // ========================
      
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Date de création en base'
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
    
    console.log('📊 Creating indexes for player evaluations...');

    // Index sur player_id (essentiel pour récupérer les évaluations d'un joueur)
    await queryInterface.addIndex('player_evaluations', {
      fields: ['player_id'],
      name: 'idx_player_evaluations_player_id',
      comment: 'Accélère les recherches d\'évaluations par joueur'
    });

    // Index sur coach_id (pour voir toutes les évaluations d'un coach)
    await queryInterface.addIndex('player_evaluations', {
      fields: ['coach_id'],
      name: 'idx_player_evaluations_coach_id',
      comment: 'Accélère les recherches d\'évaluations par coach'
    });

    // Index sur is_current (pour récupérer seulement les évaluations actuelles)
    await queryInterface.addIndex('player_evaluations', {
      fields: ['is_current'],
      name: 'idx_player_evaluations_current',
      comment: 'Accélère les recherches d\'évaluations actuelles'
    });

    // Index composite crucial : player + current
    // Optimise : "Quelle est l'évaluation actuelle de ce joueur ?"
    await queryInterface.addIndex('player_evaluations', {
      fields: ['player_id', 'is_current'],
      name: 'idx_player_evaluations_player_current',
      comment: 'Optimise la recherche de l\'évaluation actuelle d\'un joueur'
    });

    // Index pour la disponibilité de transfert (recherche importante pour recruteurs)
    await queryInterface.addIndex('player_evaluations', {
      fields: ['available_to_transfer', 'is_current'],
      name: 'idx_player_evaluations_transfer_available',
      comment: 'Optimise la recherche de joueurs disponibles au transfert'
    });

    console.log('✅ Player evaluations table created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Dropping player evaluations table...');
    await queryInterface.dropTable('player_evaluations');
    console.log('✅ Player evaluations table dropped');
  }
};