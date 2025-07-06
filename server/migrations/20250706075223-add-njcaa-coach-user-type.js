// portall/server/migrations/20250706000001-add-njcaa-coach-user-type.js

'use strict';

/**
 * Migration pour ajouter 'njcaa_coach' au type d'utilisateur
 * 
 * Cette migration étend l'ENUM user_type existant pour supporter
 * les coachs NJCAA qui ont des spécificités différentes des coachs NCAA/NAIA.
 * 
 * Logique métier :
 * - 'player' : Joueurs NJCAA (existant)
 * - 'coach' : Coachs NCAA/NAIA (existant)  
 * - 'njcaa_coach' : Coachs NJCAA (nouveau)
 * - 'admin' : Administrateurs (existant)
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔧 Adding njcaa_coach option to user_type ENUM...');
    
    try {
      // PostgreSQL nécessite une approche spéciale pour modifier un ENUM
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_users_user_type" 
        ADD VALUE IF NOT EXISTS 'njcaa_coach';
      `);
      
      console.log('✅ Successfully added njcaa_coach to user_type ENUM');
      
    } catch (error) {
      console.error('❌ Error adding njcaa_coach to ENUM:', error.message);
      
      // Si l'ENUM n'existe pas encore, le créer avec toutes les valeurs
      console.log('📝 Creating new ENUM with all values...');
      await queryInterface.sequelize.query(`
        CREATE TYPE "enum_users_user_type_new" 
        AS ENUM ('player', 'coach', 'admin', 'njcaa_coach');
      `);
      
      // Remplacer l'ancien ENUM par le nouveau
      await queryInterface.sequelize.query(`
        ALTER TABLE users 
        ALTER COLUMN user_type 
        TYPE "enum_users_user_type_new" 
        USING user_type::text::"enum_users_user_type_new";
      `);
      
      // Supprimer l'ancien ENUM
      await queryInterface.sequelize.query(`
        DROP TYPE IF EXISTS "enum_users_user_type";
      `);
      
      // Renommer le nouveau ENUM
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_users_user_type_new" 
        RENAME TO "enum_users_user_type";
      `);
      
      console.log('✅ ENUM recreated successfully with njcaa_coach option');
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Removing njcaa_coach option from user_type ENUM...');
    
    // Vérifier qu'aucun utilisateur n'utilise 'njcaa_coach' avant de le supprimer
    const njcaaCoachUsers = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count FROM users 
      WHERE user_type = 'njcaa_coach';
    `, { type: Sequelize.QueryTypes.SELECT });
    
    if (njcaaCoachUsers[0].count > 0) {
      throw new Error('Cannot remove njcaa_coach: users still use this user_type');
    }
    
    // Recréer l'ENUM sans 'njcaa_coach'
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_users_user_type_new" 
      AS ENUM ('player', 'coach', 'admin');
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TABLE users 
      ALTER COLUMN user_type 
      TYPE "enum_users_user_type_new" 
      USING user_type::text::"enum_users_user_type_new";
    `);
    
    await queryInterface.sequelize.query(`
      DROP TYPE "enum_users_user_type";
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_users_user_type_new" 
      RENAME TO "enum_users_user_type";
    `);
    
    console.log('✅ njcaa_coach option removed from user_type ENUM');
  }
};