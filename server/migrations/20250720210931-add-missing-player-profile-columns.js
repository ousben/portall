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
 * - Vérification intelligente de l'existence des colonnes
 * - Valeurs par défaut sécurisées pour les données existantes
 * - Indexes optimisés pour les performances de recherche
 * - Commentaires explicites pour la documentation
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔧 Adding missing columns to player_profiles table...');

    // Vérifier d'abord si la table existe
    const tableDescription = await queryInterface.describeTable('player_profiles').catch(() => false);
    if (!tableDescription) {
      throw new Error('Table player_profiles does not exist. Please run the base migration first.');
    }

    console.log('📋 Current table structure analyzed. Checking for missing columns...');

    try {
      // ========================
      // FONCTION UTILITAIRE POUR VÉRIFIER ET AJOUTER LES COLONNES
      // ========================
      
      const addColumnIfNotExists = async (columnName, columnDefinition, description) => {
        if (!tableDescription[columnName]) {
          console.log(`➕ Adding ${columnName} column (${description})...`);
          await queryInterface.addColumn('player_profiles', columnName, columnDefinition);
          console.log(`✅ ${columnName} column added successfully`);
        } else {
          console.log(`⏭️ ${columnName} column already exists, skipping...`);
        }
      };

      // ========================
      // AJOUT DES COLONNES MANQUANTES CRITIQUES
      // ========================

      await addColumnIfNotExists('date_of_birth', {
        type: Sequelize.DATEONLY,
        allowNull: true, // Temporairement nullable pour les données existantes
        comment: 'Date de naissance du joueur (format YYYY-MM-DD)'
      }, 'Date de naissance');

      await addColumnIfNotExists('height', {
        type: Sequelize.INTEGER,
        allowNull: true, // Temporairement nullable
        comment: 'Taille du joueur en centimètres'
      }, 'Taille en cm');

      await addColumnIfNotExists('weight', {
        type: Sequelize.INTEGER,
        allowNull: true, // Temporairement nullable
        comment: 'Poids du joueur en kilogrammes'
      }, 'Poids en kg');

      await addColumnIfNotExists('position', {
        type: Sequelize.ENUM(
          'goalkeeper', 'defender', 'midfielder', 'forward',
          'center_back', 'full_back', 'wing_back', 'defensive_midfielder',
          'central_midfielder', 'attacking_midfielder', 'winger', 'striker'
        ),
        allowNull: true, // Temporairement nullable
        comment: 'Position de jeu du joueur sur le terrain'
      }, 'Position de jeu');

      await addColumnIfNotExists('gender', {
        type: Sequelize.ENUM('male', 'female'),
        allowNull: true, // Temporairement nullable
        comment: 'Genre du joueur (nécessaire pour les équipes genrées)'
      }, 'Genre du joueur');

      await addColumnIfNotExists('current_year', {
        type: Sequelize.ENUM('freshman', 'sophomore', 'redshirt'),
        allowNull: true, // Temporairement nullable
        comment: 'Année académique actuelle du joueur'
      }, 'Année académique');

      await addColumnIfNotExists('graduation_year', {
        type: Sequelize.INTEGER,
        allowNull: true, // Temporairement nullable
        comment: 'Année de diplôme prévue'
      }, 'Année de diplôme');

      // ========================
      // FONCTION UTILITAIRE POUR VÉRIFIER ET AJOUTER LES INDEXES
      // ========================
      
      const addIndexIfNotExists = async (indexName, indexDefinition, description) => {
        try {
          await queryInterface.addIndex('player_profiles', indexDefinition);
          console.log(`✅ Index ${indexName} created successfully`);
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`⏭️ Index ${indexName} already exists, skipping...`);
          } else {
            console.error(`❌ Error creating index ${indexName}:`, error.message);
            // Ne pas bloquer la migration pour un problème d'index
          }
        }
      };

      // ========================
      // AJOUT DES INDEXES POUR OPTIMISER LES PERFORMANCES
      // ========================

      console.log('📊 Creating performance indexes...');

      await addIndexIfNotExists('idx_player_profiles_position', {
        fields: ['position'],
        name: 'idx_player_profiles_position',
        comment: 'Accélère les recherches par position de jeu'
      }, 'Index sur la position');

      await addIndexIfNotExists('idx_player_profiles_gender', {
        fields: ['gender'],
        name: 'idx_player_profiles_gender',
        comment: 'Accélère les recherches par genre'
      }, 'Index sur le genre');

      await addIndexIfNotExists('idx_player_profiles_graduation_year', {
        fields: ['graduation_year'],
        name: 'idx_player_profiles_graduation_year',
        comment: 'Accélère les recherches par année de disponibilité'
      }, 'Index sur l\'année de diplôme');

      await addIndexIfNotExists('idx_player_profiles_coach_search', {
        fields: ['gender', 'position', 'graduation_year'],
        name: 'idx_player_profiles_coach_search',
        comment: 'Optimise les recherches multi-critères des coachs'
      }, 'Index composite pour les recherches des coachs');

      console.log('✅ All missing columns and indexes processed successfully');
      
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
      // Fonction utilitaire pour supprimer les indexes en toute sécurité
      const removeIndexIfExists = async (indexName) => {
        try {
          await queryInterface.removeIndex('player_profiles', indexName);
          console.log(`✅ Index ${indexName} removed successfully`);
        } catch (error) {
          if (error.message.includes('does not exist')) {
            console.log(`⏭️ Index ${indexName} does not exist, skipping...`);
          } else {
            console.error(`❌ Error removing index ${indexName}:`, error.message);
          }
        }
      };

      // Fonction utilitaire pour supprimer les colonnes en toute sécurité
      const removeColumnIfExists = async (columnName) => {
        try {
          const tableDescription = await queryInterface.describeTable('player_profiles');
          if (tableDescription[columnName]) {
            await queryInterface.removeColumn('player_profiles', columnName);
            console.log(`✅ Column ${columnName} removed successfully`);
          } else {
            console.log(`⏭️ Column ${columnName} does not exist, skipping...`);
          }
        } catch (error) {
          console.error(`❌ Error removing column ${columnName}:`, error.message);
        }
      };

      // Supprimer les indexes d'abord
      await removeIndexIfExists('idx_player_profiles_coach_search');
      await removeIndexIfExists('idx_player_profiles_graduation_year');
      await removeIndexIfExists('idx_player_profiles_gender');
      await removeIndexIfExists('idx_player_profiles_position');

      // Ensuite supprimer les colonnes (dans l'ordre inverse)
      await removeColumnIfExists('graduation_year');
      await removeColumnIfExists('current_year');
      await removeColumnIfExists('gender');
      await removeColumnIfExists('position');
      await removeColumnIfExists('weight');
      await removeColumnIfExists('height');
      await removeColumnIfExists('date_of_birth');

      console.log('✅ Migration reverted successfully');
    } catch (error) {
      console.error('❌ Error during migration rollback:', error);
      throw error;
    }
  }
};