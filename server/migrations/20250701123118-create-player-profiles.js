// portall/server/migrations/20250701123118-create-player-profiles.js

'use strict';

/**
 * Migration pour créer la table des profils joueurs
 * 
 * Cette table étend les informations de base des utilisateurs avec
 * des données spécifiques aux joueurs NJCAA. Elle établit des relations
 * avec la table users (1:1) and njcaa_colleges (N:1).
 * 
 * Concepts métier importants :
 * - Un joueur = un utilisateur + des informations soccer spécifiques
 * - Chaque joueur appartient à un seul college NJCAA
 * - Le profil peut être invisible jusqu'à validation admin
 * - Analytics intégrées (vues du profil, dernière mise à jour)
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('👤 Creating player profiles table...');

    await queryInterface.createTable('player_profiles', {
      // ========================
      // IDENTIFIANTS ET RELATIONS
      // ========================
      
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'Identifiant unique du profil joueur'
      },

      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true, // Un utilisateur = un seul profil joueur maximum
        references: {
          model: 'users', // Référence vers la table users existante
          key: 'id'
        },
        onUpdate: 'CASCADE', // Si l'ID user change, mettre à jour ici
        onDelete: 'CASCADE', // Si l'user est supprimé, supprimer le profil
        comment: 'Référence vers l\'utilisateur propriétaire de ce profil'
      },

      college_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'njcaa_colleges', // Référence vers les colleges NJCAA
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT', // Empêche la suppression d'un college utilisé
        comment: 'College NJCAA où le joueur est inscrit'
      },

      // ========================
      // INFORMATIONS PERSONNELLES ÉTENDUES
      // ========================
      
      gender: {
        type: Sequelize.ENUM('male', 'female'),
        allowNull: false,
        comment: 'Genre du joueur (nécessaire pour les équipes genrées)'
      },

      // ========================
      // GESTION DU PROFIL
      // ========================
      
      profile_completion_status: {
        type: Sequelize.ENUM('basic', 'completed', 'premium'),
        allowNull: false,
        defaultValue: 'basic',
        comment: 'Niveau de complétude du profil (basic = inscription seule, completed = toutes infos, premium = avec vidéos)'
      },

      is_profile_visible: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false, // Invisible par défaut jusqu'à validation admin
        comment: 'Contrôle si le profil est visible aux coachs'
      },

      // ========================
      // ANALYTICS ET MÉTRIQUES
      // ========================
      
      profile_views: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Nombre total de vues du profil par les coachs'
      },

      last_profile_update: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Dernière fois que le joueur a modifié son profil'
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
    
    console.log('📊 Creating indexes for player profiles...');

    // Index sur user_id (relation 1:1, déjà unique mais améliore les jointures)
    await queryInterface.addIndex('player_profiles', {
      fields: ['user_id'],
      unique: true,
      name: 'idx_player_profiles_user_id',
      comment: 'Garantit et accélère la relation 1:1 avec users'
    });

    // Index sur college_id (pour rechercher les joueurs d'un college)
    await queryInterface.addIndex('player_profiles', {
      fields: ['college_id'],
      name: 'idx_player_profiles_college_id',
      comment: 'Accélère les recherches de joueurs par college'
    });

    // Index sur le genre (pour filtrer par équipes masculines/féminines)
    await queryInterface.addIndex('player_profiles', {
      fields: ['gender'],
      name: 'idx_player_profiles_gender',
      comment: 'Accélère les recherches par genre'
    });

    // Index sur la visibilité (très important pour les recherches de coachs)
    await queryInterface.addIndex('player_profiles', {
      fields: ['is_profile_visible'],
      name: 'idx_player_profiles_visible',
      comment: 'Accélère les recherches de profils visibles'
    });

    // Index sur le statut de complétude (pour promouvoir les profils complets)
    await queryInterface.addIndex('player_profiles', {
      fields: ['profile_completion_status'],
      name: 'idx_player_profiles_completion',
      comment: 'Accélère les recherches par niveau de profil'
    });

    // Index composite très important : genre + visible + college
    // Cet index optimise la requête la plus fréquente des coachs :
    // "Montrer tous les joueurs masculins visibles d'un college donné"
    await queryInterface.addIndex('player_profiles', {
      fields: ['gender', 'is_profile_visible', 'college_id'],
      name: 'idx_player_profiles_search_optimization',
      comment: 'Optimise les recherches principales des coachs'
    });

    // Index sur les vues de profil (pour les classements par popularité)
    await queryInterface.addIndex('player_profiles', {
      fields: ['profile_views'],
      name: 'idx_player_profiles_views',
      comment: 'Accélère les classements par popularité'
    });

    console.log('✅ Player profiles table created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Dropping player profiles table...');
    await queryInterface.dropTable('player_profiles');
    console.log('✅ Player profiles table dropped');
  }
};