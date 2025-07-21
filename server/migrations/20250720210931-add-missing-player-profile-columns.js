// portall/server/migrations/20250720210931-add-missing-player-profile-columns.js

'use strict';

/**
 * 🔧 Migration de Correction : Ajout des Colonnes Manquantes aux Profils Joueurs
 * 
 * Cette migration résout un problème de désynchronisation entre le modèle PlayerProfile
 * et le schéma physique de la table player_profiles. Elle ajoute toutes les colonnes
 * que le modèle attend mais qui n'existent pas encore en base de données.
 * 
 * 🎯 Problème résolu :
 * L'erreur "column 'date_of_birth' of relation 'player_profiles' does not exist"
 * et toutes les colonnes manquantes similaires.
 * 
 * 🏗️ Approche architecturale :
 * - Migration incrémentale (addColumn) plutôt que reconstruction complète
 * - Valeurs par défaut sécurisées pour les données existantes
 * - Indexes optimisés pour les performances de recherche
 * - Commentaires explicites pour la documentation
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔧 Adding missing columns to player_profiles table...');

    // Vérifier d'abord si la table existe
    const tableExists = await queryInterface.describeTable('player_profiles').catch(() => false);
    if (!tableExists) {
      throw new Error('Table player_profiles does not exist. Please run the base migration first.');
    }

    try {
      // ========================
      // AJOUT DES COLONNES MANQUANTES CRITIQUES
      // ========================

      console.log('📅 Adding date_of_birth column...');
      await queryInterface.addColumn('player_profiles', 'date_of_birth', {
        type: Sequelize.DATEONLY,
        allowNull: true, // Temporairement nullable pour les données existantes
        comment: 'Date de naissance du joueur (format YYYY-MM-DD)'
      });

      console.log('📏 Adding height column...');
      await queryInterface.addColumn('player_profiles', 'height', {
        type: Sequelize.INTEGER,
        allowNull: true, // Temporairement nullable
        comment: 'Taille du joueur en centimètres'
      });

      console.log('⚖️ Adding weight column...');
      await queryInterface.addColumn('player_profiles', 'weight', {
        type: Sequelize.INTEGER,
        allowNull: true, // Temporairement nullable
        comment: 'Poids du joueur en kilogrammes'
      });

      console.log('🎯 Adding position column...');
      await queryInterface.addColumn('player_profiles', 'position', {
        type: Sequelize.ENUM(
          'quarterback', 'running_back', 'fullback', 'wide_receiver', 'tight_end',
          'offensive_line', 'center', 'guard', 'tackle',
          'defensive_end', 'defensive_tackle', 'nose_tackle', 'linebacker',
          'cornerback', 'safety', 'free_safety', 'strong_safety',
          'kicker', 'punter', 'long_snapper', 'return_specialist'
        ),
        allowNull: true, // Temporairement nullable
        comment: 'Position de jeu du joueur sur le terrain'
      });

      console.log('👥 Adding gender column...');
      await queryInterface.addColumn('player_profiles', 'gender', {
        type: Sequelize.ENUM('male', 'female'),
        allowNull: true, // Temporairement nullable
        comment: 'Genre du joueur (nécessaire pour les équipes genrées)'
      });

      console.log('🎓 Adding current_year column...');
      await queryInterface.addColumn('player_profiles', 'current_year', {
        type: Sequelize.ENUM('freshman', 'sophomore', 'redshirt'),
        allowNull: true, // Temporairement nullable
        comment: 'Année académique actuelle du joueur'
      });

      console.log('📅 Adding graduation_year column...');
      await queryInterface.addColumn('player_profiles', 'graduation_year', {
        type: Sequelize.INTEGER,
        allowNull: true, // Temporairement nullable
        comment: 'Année de diplôme prévue'
      });

      // ========================
      // AJOUT DES INDEXES POUR OPTIMISER LES PERFORMANCES
      // ========================

      console.log('📊 Creating performance indexes...');

      // Index sur la position (recherches fréquentes par coachs)
      await queryInterface.addIndex('player_profiles', {
        fields: ['position'],
        name: 'idx_player_profiles_position',
        comment: 'Accélère les recherches par position de jeu'
      });

      // Index sur le genre (filtrage par équipes masculines/féminines)
      await queryInterface.addIndex('player_profiles', {
        fields: ['gender'],
        name: 'idx_player_profiles_gender',
        comment: 'Accélère les recherches par genre'
      });

      // Index sur l'année de diplôme (recherches par disponibilité temporelle)
      await queryInterface.addIndex('player_profiles', {
        fields: ['graduation_year'],
        name: 'idx_player_profiles_graduation_year',
        comment: 'Accélère les recherches par année de disponibilité'
      });

      // Index composite pour les recherches complexes des coachs
      await queryInterface.addIndex('player_profiles', {
        fields: ['gender', 'position', 'graduation_year'],
        name: 'idx_player_profiles_coach_search',
        comment: 'Optimise les recherches multi-critères des coachs'
      });

      console.log('✅ All missing columns and indexes added successfully');
      
      // ========================
      // INFORMATION IMPORTANTE POUR LA SUITE
      // ========================
      
      console.log('');
      console.log('🎯 MIGRATION COMPLETED SUCCESSFULLY');
      console.log('');
      console.log('📝 Important Notes:');
      console.log('   • All new columns are temporarily nullable to handle existing data');
      console.log('   • You may want to update existing records with default values');
      console.log('   • Consider making critical columns NOT NULL after data cleanup');
      console.log('');
      console.log('🔄 Next Steps:');
      console.log('   1. Test player registration - should now work completely');
      console.log('   2. Consider data migration for existing records if any');
      console.log('   3. Update validation rules if needed');
      console.log('');

    } catch (error) {
      console.error('❌ Error during migration:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Reverting player_profiles column additions...');

    try {
      // Supprimer les indexes d'abord
      await queryInterface.removeIndex('player_profiles', 'idx_player_profiles_coach_search');
      await queryInterface.removeIndex('player_profiles', 'idx_player_profiles_graduation_year');
      await queryInterface.removeIndex('player_profiles', 'idx_player_profiles_gender');
      await queryInterface.removeIndex('player_profiles', 'idx_player_profiles_position');

      // Ensuite supprimer les colonnes (dans l'ordre inverse)
      await queryInterface.removeColumn('player_profiles', 'graduation_year');
      await queryInterface.removeColumn('player_profiles', 'current_year');
      await queryInterface.removeColumn('player_profiles', 'gender');
      await queryInterface.removeColumn('player_profiles', 'position');
      await queryInterface.removeColumn('player_profiles', 'weight');
      await queryInterface.removeColumn('player_profiles', 'height');
      await queryInterface.removeColumn('player_profiles', 'date_of_birth');

      console.log('✅ Migration reverted successfully');
    } catch (error) {
      console.error('❌ Error during migration rollback:', error);
      throw error;
    }
  }
};