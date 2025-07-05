// portall/server/migrations/20250705140742-add-week-to-billing-interval.js

'use strict';

/**
 * Migration pour ajouter 'week' comme option de billing_interval
 * 
 * Cette migration étend l'ENUM existant pour permettre les tests
 * d'intégration webhook avec des plans hebdomadaires.
 * 
 * IMPORTANT : Cette valeur 'week' est destinée uniquement aux tests.
 * En production, seuls 'month' et 'year' seront utilisés.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔧 Adding week option to billing_interval ENUM...');
    
    try {
      // PostgreSQL nécessite une approche spéciale pour modifier un ENUM
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_subscription_plans_billing_interval" 
        ADD VALUE IF NOT EXISTS 'week';
      `);
      
      console.log('✅ Successfully added week to billing_interval ENUM');
      
    } catch (error) {
      console.error('❌ Error adding week to ENUM:', error.message);
      
      // Si l'ENUM n'existe pas encore, le créer avec toutes les valeurs
      console.log('📝 Creating new ENUM with all values...');
      await queryInterface.sequelize.query(`
        CREATE TYPE "enum_subscription_plans_billing_interval_new" 
        AS ENUM ('month', 'year', 'week');
      `);
      
      // Remplacer l'ancien ENUM par le nouveau
      await queryInterface.sequelize.query(`
        ALTER TABLE subscription_plans 
        ALTER COLUMN billing_interval 
        TYPE "enum_subscription_plans_billing_interval_new" 
        USING billing_interval::text::"enum_subscription_plans_billing_interval_new";
      `);
      
      // Supprimer l'ancien ENUM
      await queryInterface.sequelize.query(`
        DROP TYPE IF EXISTS "enum_subscription_plans_billing_interval";
      `);
      
      // Renommer le nouveau ENUM
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_subscription_plans_billing_interval_new" 
        RENAME TO "enum_subscription_plans_billing_interval";
      `);
      
      console.log('✅ ENUM recreated successfully with week option');
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Removing week option from billing_interval ENUM...');
    
    // Vérifier qu'aucun plan n'utilise 'week' avant de le supprimer
    const weekPlans = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count FROM subscription_plans 
      WHERE billing_interval = 'week';
    `, { type: Sequelize.QueryTypes.SELECT });
    
    if (weekPlans[0].count > 0) {
      throw new Error('Cannot remove week: plans still use this billing_interval');
    }
    
    // Recréer l'ENUM sans 'week'
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_subscription_plans_billing_interval_new" 
      AS ENUM ('month', 'year');
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TABLE subscription_plans 
      ALTER COLUMN billing_interval 
      TYPE "enum_subscription_plans_billing_interval_new" 
      USING billing_interval::text::"enum_subscription_plans_billing_interval_new";
    `);
    
    await queryInterface.sequelize.query(`
      DROP TYPE "enum_subscription_plans_billing_interval";
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_subscription_plans_billing_interval_new" 
      RENAME TO "enum_subscription_plans_billing_interval";
    `);
    
    console.log('✅ Week option removed from billing_interval ENUM');
  }
};