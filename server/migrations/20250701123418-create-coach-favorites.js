// portall/server/migrations/20250701123418-create-coach-favorites.js

'use strict';

/**
 * Migration pour créer la table de liaison coach_favorites
 * 
 * Cette table implémente la relation many-to-many entre coachs et joueurs
 * pour la fonctionnalité "favoris". Elle permet aux coachs de sauvegarder
 * les profils de joueurs qui les intéressent pour un suivi ultérieur.
 * 
 * Concepts de relation many-to-many :
 * - Table de jonction (junction table) sans données métier propres
 * - Clés étrangères vers les deux tables liées
 * - Index composite pour éviter les doublons
 * - Métadonnées pour tracer quand/comment le favori a été ajouté
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('⭐ Creating coach favorites junction table...');

    await queryInterface.createTable('coach_favorites', {
      // ========================
      // IDENTIFIANT PRIMAIRE COMPOSITE
      // ========================
      // Nous n'utilisons pas d'ID auto-incrémenté ici car
      // la combinaison (coach_id, player_id) est naturellement unique
      
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'ID technique pour simplifier les opérations (optionnel dans ce type de table)'
      },

      // ========================
      // CLÉS ÉTRANGÈRES (CŒUR DE LA RELATION)
      // ========================
      
      coach_profile_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'coach_profiles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', // Si le coach est supprimé, ses favoris disparaissent
        comment: 'Référence vers le profil coach qui a mis en favori'
      },

      player_profile_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'player_profiles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', // Si le joueur est supprimé, il disparaît des favoris
        comment: 'Référence vers le profil joueur mis en favori'
      },

      // ========================
      // MÉTADONNÉES MÉTIER UTILES
      // ========================
      
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notes privées du coach sur ce joueur (observations, points d\'intérêt, etc.)'
      },

      priority_level: {
        type: Sequelize.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'medium',
        comment: 'Niveau de priorité assigné par le coach à ce joueur'
      },

      recruitment_status: {
        type: Sequelize.ENUM('interested', 'contacted', 'evaluating', 'offer_made', 'declined', 'committed'),
        allowNull: false,
        defaultValue: 'interested',
        comment: 'Statut dans le processus de recrutement'
      },

      last_contacted: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Dernière fois que le coach a contacté ce joueur'
      },

      // ========================
      // MÉTADONNÉES SYSTÈME
      // ========================
      
      favorited_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Quand ce joueur a été ajouté aux favoris'
      },

      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Dernière modification de cet enregistrement favori'
      }
    });

    // ========================
    // INDEX CRITIQUES POUR LES PERFORMANCES
    // ========================
    
    console.log('📊 Creating indexes for coach favorites...');

    // Index composite UNIQUE sur la relation (évite les doublons)
    // Un coach ne peut pas mettre le même joueur en favori deux fois
    await queryInterface.addIndex('coach_favorites', {
      fields: ['coach_profile_id', 'player_profile_id'],
      unique: true,
      name: 'idx_coach_favorites_unique_relation',
      comment: 'Empêche les doublons et accélère les vérifications d\'existence'
    });

    // Index sur coach_profile_id (pour récupérer tous les favoris d'un coach)
    await queryInterface.addIndex('coach_favorites', {
      fields: ['coach_profile_id'],
      name: 'idx_coach_favorites_coach_id',
      comment: 'Accélère la récupération des favoris d\'un coach'
    });

    // Index sur player_profile_id (pour voir quels coachs ont mis un joueur en favori)
    await queryInterface.addIndex('coach_favorites', {
      fields: ['player_profile_id'],
      name: 'idx_coach_favorites_player_id',
      comment: 'Accélère la vérification de popularité d\'un joueur'
    });

    // Index sur le niveau de priorité (pour trier les favoris)
    await queryInterface.addIndex('coach_favorites', {
      fields: ['priority_level'],
      name: 'idx_coach_favorites_priority',
      comment: 'Accélère les recherches par priorité'
    });

    // Index sur le statut de recrutement (pour suivre le pipeline)
    await queryInterface.addIndex('coach_favorites', {
      fields: ['recruitment_status'],
      name: 'idx_coach_favorites_status',
      comment: 'Accélère les recherches par statut de recrutement'
    });

    // Index composite pour les recherches complexes : coach + priorité + statut
    await queryInterface.addIndex('coach_favorites', {
      fields: ['coach_profile_id', 'priority_level', 'recruitment_status'],
      name: 'idx_coach_favorites_coach_priority_status',
      comment: 'Optimise les tableaux de bord de recrutement des coachs'
    });

    // Index sur la date d'ajout aux favoris (pour trier chronologiquement)
    await queryInterface.addIndex('coach_favorites', {
      fields: ['favorited_at'],
      name: 'idx_coach_favorites_date',
      comment: 'Accélère les tris chronologiques'
    });

    console.log('✅ Coach favorites table created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Dropping coach favorites table...');
    await queryInterface.dropTable('coach_favorites');
    console.log('✅ Coach favorites table dropped');
  }
};