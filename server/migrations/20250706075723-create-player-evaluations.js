// portall/server/migrations/20250706075723-create-player-evaluations.js

'use strict';

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

      // ✅ CORRECTION : Noms cohérents avec le modèle et contrôleur
      player_profile_id: {
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

      njcaa_coach_profile_id: {
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
      // CRITÈRES D'ÉVALUATION TECHNIQUES (1-10)
      // ========================
      
      speed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Vitesse du joueur (1-10)'
      },

      agility: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Agilité du joueur (1-10)'
      },

      ball_control: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Contrôle de balle (1-10)'
      },

      passing: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Capacité de passe (1-10)'
      },

      shooting: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Précision de tir (1-10)'
      },

      defending: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Capacité défensive (1-10)'
      },

      game_intelligence: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Intelligence de jeu (1-10)'
      },

      work_ethic: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Éthique de travail (1-10)'
      },

      physical_fitness: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Condition physique (1-10)'
      },

      leadership: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Leadership (1-10)'
      },

      overall_score: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'Note globale (1-10)'
      },

      // ========================
      // INFORMATIONS MÉTIER
      // ========================

      available_to_transfer: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        comment: 'Le joueur est-il disponible pour un transfert ?'
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

      // ========================
      // COMMENTAIRES TEXTUELS
      // ========================

      coachability_comment: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Commentaire sur la capacité à être coaché'
      },

      technique: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Évaluation technique détaillée'
      },

      physique: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Évaluation physique détaillée'
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },

      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // ========================
    // INDEX POUR OPTIMISER LES RECHERCHES
    // ========================
    
    console.log('📊 Creating indexes for player evaluations...');

    // Index sur player_profile_id
    await queryInterface.addIndex('player_evaluations', {
      fields: ['player_profile_id'],
      name: 'idx_player_evaluations_player_profile_id'
    });

    // Index sur njcaa_coach_profile_id
    await queryInterface.addIndex('player_evaluations', {
      fields: ['njcaa_coach_profile_id'],
      name: 'idx_player_evaluations_njcaa_coach_profile_id'
    });

    // Index unique pour éviter les doublons
    await queryInterface.addIndex('player_evaluations', {
      fields: ['player_profile_id', 'njcaa_coach_profile_id'],
      unique: true,
      name: 'unique_evaluation_per_player_coach'
    });

    // Index pour la disponibilité de transfert
    await queryInterface.addIndex('player_evaluations', {
      fields: ['available_to_transfer'],
      name: 'idx_player_evaluations_transfer_available'
    });

    console.log('✅ Player evaluations table created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Dropping player evaluations table...');
    await queryInterface.dropTable('player_evaluations');
    console.log('✅ Player evaluations table dropped');
  }
};