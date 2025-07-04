// portall/server/scripts/sync-stripe-plans.js

/**
 * Script de synchronisation des plans Portall avec Stripe
 * 
 * Ce script est le "chef d'orchestre" de votre système de paiement.
 * Il s'assure que vos plans locaux correspondent exactement à ce qui
 * existe chez Stripe, et vice-versa.
 * 
 * Pourquoi ce script est-il crucial ?
 * 
 * 1. COHÉRENCE : Évite les désynchronisations entre votre DB et Stripe
 * 2. IDEMPOTENCE : Peut être exécuté plusieurs fois sans effet de bord
 * 3. RÉCUPÉRATION : Répare automatiquement les incohérences
 * 4. INITIALISATION : Configure automatiquement un nouvel environnement
 * 
 * Ce script peut être lancé :
 * - Au démarrage de l'application (automatique)
 * - Manuellement en cas de problème
 * - Lors du déploiement en production
 */

const { sequelize } = require('../config/database.connection');
const { stripe, PORTALL_PLANS, createStripeCustomer } = require('../config/stripe');

// Import des modèles
const SubscriptionPlan = require('../models/SubscriptionPlan')(sequelize, sequelize.Sequelize.DataTypes);

/**
 * Fonction principale de synchronisation
 * 
 * Cette fonction orchestré tout le processus de synchronisation
 * avec une gestion d'erreur robuste et des logs détaillés.
 */
async function syncStripeWithPortall() {
  console.log('🚀 Starting Stripe-Portall synchronization...');
  console.log('===============================================');
  
  try {
    // Étape 1: Vérifier la connexion à Stripe
    await verifyStripeConnection();
    
    // Étape 2: Vérifier la connexion à la base de données
    await verifyDatabaseConnection();
    
    // Étape 3: Synchroniser les plans dans la base de données
    await syncDatabasePlans();
    
    // Étape 4: Créer/synchroniser les produits Stripe
    await syncStripeProducts();
    
    // Étape 5: Validation finale
    await validateSynchronization();
    
    console.log('\n🎉 Synchronization completed successfully!');
    console.log('✅ Your Portall payment system is ready to accept subscriptions');
    
  } catch (error) {
    console.error('\n❌ Synchronization failed:', error.message);
    console.error('🔧 Please check your configuration and try again');
    throw error;
  }
}

/**
 * Étape 1: Vérifier la connexion à Stripe
 * 
 * Teste que vos clés API Stripe sont valides et que le service répond.
 */
async function verifyStripeConnection() {
  console.log('\n🔐 Step 1: Verifying Stripe connection...');
  
  try {
    // Test simple : lister les produits existants
    const products = await stripe.products.list({ limit: 1 });
    console.log('✅ Stripe connection successful');
    console.log(`   Account has ${products.data.length > 0 ? 'existing' : 'no'} products`);
    
  } catch (error) {
    console.error('❌ Stripe connection failed');
    console.error('   Please check your STRIPE_SECRET_KEY in .env file');
    throw new Error(`Stripe connection failed: ${error.message}`);
  }
}

/**
 * Étape 2: Vérifier la connexion à la base de données
 * 
 * S'assure que votre base de données PostgreSQL répond et que les tables existent.
 */
async function verifyDatabaseConnection() {
  console.log('\n🗃️ Step 2: Verifying database connection...');
  
  try {
    // Tester la connexion
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Vérifier que la table subscription_plans existe
    await sequelize.getQueryInterface().describeTable('subscription_plans');
    console.log('✅ subscription_plans table exists');
    
  } catch (error) {
    console.error('❌ Database connection failed');
    console.error('   Please ensure PostgreSQL is running and tables are migrated');
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

/**
 * Étape 3: Synchroniser les plans dans la base de données
 * 
 * Crée ou met à jour les plans Portall dans votre base de données locale.
 * Cette fonction est idempotente : elle peut être exécutée plusieurs fois sans problème.
 */
async function syncDatabasePlans() {
  console.log('\n📊 Step 3: Synchronizing database plans...');
  
  const transaction = await sequelize.transaction();
  
  try {
    let createdCount = 0;
    let updatedCount = 0;
    
    for (const [planKey, planConfig] of Object.entries(PORTALL_PLANS)) {
      console.log(`   Processing plan: ${planConfig.name}`);
      
      // Chercher si le plan existe déjà
      const [plan, created] = await SubscriptionPlan.findOrCreate({
        where: {
          billing_interval: planConfig.interval,
          price_in_cents: planConfig.price_in_cents
        },
        defaults: {
          name: planConfig.name,
          description: planConfig.description,
          price_in_cents: planConfig.price_in_cents,
          currency: 'USD',
          billing_interval: planConfig.interval,
          allowed_user_types: ['coach', 'player'],
          features: {
            profileAccess: true,
            searchAccess: true,
            contactCoaches: true,
            viewPlayerProfiles: true,
            favoriteProfiles: true,
            analyticsBasic: true
          },
          is_active: true,
          display_order: planConfig.display_order
        },
        transaction
      });
      
      if (created) {
        console.log(`   ✅ Created new plan: ${plan.name}`);
        createdCount++;
      } else {
        // Mettre à jour si nécessaire
        const updates = {};
        if (plan.name !== planConfig.name) updates.name = planConfig.name;
        if (plan.description !== planConfig.description) updates.description = planConfig.description;
        if (plan.display_order !== planConfig.display_order) updates.display_order = planConfig.display_order;
        
        if (Object.keys(updates).length > 0) {
          await plan.update(updates, { transaction });
          console.log(`   ✅ Updated plan: ${plan.name}`);
          updatedCount++;
        } else {
          console.log(`   ℹ️ Plan already up to date: ${plan.name}`);
        }
      }
    }
    
    await transaction.commit();
    
    console.log(`✅ Database sync complete: ${createdCount} created, ${updatedCount} updated`);
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Database sync failed:', error.message);
    throw error;
  }
}

/**
 * Étape 4: Créer/synchroniser les produits Stripe
 * 
 * Pour chaque plan en base de données, s'assure qu'il existe un produit
 * et un prix correspondant chez Stripe.
 */
async function syncStripeProducts() {
  console.log('\n🏪 Step 4: Synchronizing Stripe products...');
  
  try {
    // Récupérer tous les plans actifs de la base de données
    const dbPlans = await SubscriptionPlan.findAll({
      where: { is_active: true },
      order: [['display_order', 'ASC']]
    });
    
    console.log(`   Found ${dbPlans.length} active plans in database`);
    
    for (const dbPlan of dbPlans) {
      console.log(`   Processing: ${dbPlan.name}`);
      
      let stripeProductId = null;
      let stripePriceId = null;
      
      // Si le plan a déjà un stripe_price_id, vérifier qu'il existe
      if (dbPlan.stripe_price_id) {
        try {
          const existingPrice = await stripe.prices.retrieve(dbPlan.stripe_price_id);
          stripeProductId = existingPrice.product;
          stripePriceId = existingPrice.id;
          console.log(`   ✅ Found existing Stripe price: ${stripePriceId}`);
          continue; // Passer au plan suivant
        } catch (error) {
          console.log(`   ⚠️ Stripe price ${dbPlan.stripe_price_id} not found, will recreate`);
        }
      }
      
      // Créer le produit Stripe
      console.log(`   🏗️ Creating Stripe product for: ${dbPlan.name}`);
      
      const product = await stripe.products.create({
        name: dbPlan.name,
        description: dbPlan.description,
        metadata: {
          portall_plan_id: dbPlan.id.toString(),
          portall_plan_type: dbPlan.billing_interval,
          created_by: 'portall_sync_script',
          sync_timestamp: new Date().toISOString()
        }
      });
      
      stripeProductId = product.id;
      console.log(`   ✅ Created Stripe product: ${stripeProductId}`);
      
      // Créer le prix Stripe
      console.log(`   💰 Creating Stripe price for: ${dbPlan.name}`);
      
      const price = await stripe.prices.create({
        unit_amount: dbPlan.price_in_cents,
        currency: dbPlan.currency.toLowerCase(),
        recurring: {
          interval: dbPlan.billing_interval
        },
        product: stripeProductId,
        metadata: {
          portall_plan_id: dbPlan.id.toString(),
          portall_plan_type: dbPlan.billing_interval,
          display_order: dbPlan.display_order.toString()
        }
      });
      
      stripePriceId = price.id;
      console.log(`   ✅ Created Stripe price: ${stripePriceId}`);
      
      // Mettre à jour le plan en base avec l'ID Stripe
      await dbPlan.update({
        stripe_price_id: stripePriceId
      });
      
      console.log(`   ✅ Updated database with Stripe price ID`);
    }
    
    console.log('✅ Stripe products sync complete');
    
  } catch (error) {
    console.error('❌ Stripe products sync failed:', error.message);
    throw error;
  }
}

/**
 * Étape 5: Validation finale
 * 
 * Vérifie que tout est cohérent entre la base de données et Stripe.
 */
async function validateSynchronization() {
  console.log('\n🔍 Step 5: Final validation...');
  
  try {
    // Vérifier que tous les plans ont un stripe_price_id
    const plansWithoutStripeId = await SubscriptionPlan.count({
      where: {
        is_active: true,
        stripe_price_id: null
      }
    });
    
    if (plansWithoutStripeId > 0) {
      throw new Error(`${plansWithoutStripeId} active plans missing Stripe price ID`);
    }
    
    // Vérifier que tous les stripe_price_id correspondent à de vrais prix
    const activePlans = await SubscriptionPlan.findAll({
      where: { is_active: true }
    });
    
    for (const plan of activePlans) {
      try {
        const stripePrice = await stripe.prices.retrieve(plan.stripe_price_id);
        
        // Vérifier la cohérence des prix
        if (stripePrice.unit_amount !== plan.price_in_cents) {
          throw new Error(`Price mismatch for plan ${plan.name}: DB=${plan.price_in_cents}, Stripe=${stripePrice.unit_amount}`);
        }
        
        // Vérifier la cohérence des intervalles
        if (stripePrice.recurring.interval !== plan.billing_interval) {
          throw new Error(`Interval mismatch for plan ${plan.name}: DB=${plan.billing_interval}, Stripe=${stripePrice.recurring.interval}`);
        }
        
      } catch (error) {
        throw new Error(`Validation failed for plan ${plan.name}: ${error.message}`);
      }
    }
    
    console.log('✅ All validations passed');
    
    // Afficher le résumé final
    console.log('\n📋 Synchronization Summary:');
    console.log('===========================');
    for (const plan of activePlans) {
      const savings = plan.billing_interval === 'year' ? 
        ` (Save $${((29.99 * 12) - (plan.price_in_cents / 100)).toFixed(2)}/year)` : '';
      console.log(`   📦 ${plan.name}: $${(plan.price_in_cents / 100).toFixed(2)}/${plan.billing_interval}${savings}`);
      console.log(`      Stripe Price ID: ${plan.stripe_price_id}`);
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    throw error;
  }
}

/**
 * Fonction utilitaire pour nettoyer les données Stripe orphelines
 * 
 * Cette fonction optionnelle supprime les produits Stripe qui ne correspondent
 * plus à aucun plan en base de données. Utilisez avec précaution !
 */
async function cleanupOrphanedStripeProducts() {
  console.log('\n🧹 Cleaning up orphaned Stripe products...');
  
  try {
    // Récupérer tous les produits Stripe créés par Portall
    const stripeProducts = await stripe.products.list({
      limit: 100,
      expand: ['data.default_price']
    });
    
    const portallProducts = stripeProducts.data.filter(product => 
      product.metadata && product.metadata.created_by === 'portall_sync_script'
    );
    
    // Récupérer tous les stripe_price_id actifs en base
    const activePlans = await SubscriptionPlan.findAll({
      where: { is_active: true },
      attributes: ['stripe_price_id']
    });
    
    const activeStripePriceIds = activePlans.map(plan => plan.stripe_price_id);
    
    // Identifier les produits orphelins
    let orphanedCount = 0;
    for (const product of portallProducts) {
      const productPrices = await stripe.prices.list({
        product: product.id,
        limit: 100
      });
      
      const hasActivePrices = productPrices.data.some(price => 
        activeStripePriceIds.includes(price.id)
      );
      
      if (!hasActivePrices) {
        console.log(`   🗑️ Found orphaned product: ${product.name} (${product.id})`);
        
        // Archiver le produit (Stripe ne permet pas la suppression)
        await stripe.products.update(product.id, {
          active: false,
          metadata: {
            ...product.metadata,
            archived_by: 'portall_cleanup',
            archived_at: new Date().toISOString()
          }
        });
        
        orphanedCount++;
      }
    }
    
    console.log(`✅ Cleanup complete: ${orphanedCount} orphaned products archived`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    // Ne pas faire échouer le script principal pour un échec de nettoyage
  }
}

/**
 * Fonction principale - Point d'entrée du script
 */
async function main() {
  try {
    await syncStripeWithPortall();
    
    // Optionnel : nettoyer les produits orphelins
    // await cleanupOrphanedStripeProducts();
    
    console.log('\n🎯 Next steps:');
    console.log('1. Test your subscription flow in the frontend');
    console.log('2. Configure webhooks in your Stripe dashboard');
    console.log('3. Test payment scenarios with Stripe test cards');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Script failed:', error.message);
    console.error('\n🔧 Troubleshooting tips:');
    console.error('1. Check your .env file contains valid Stripe keys');
    console.error('2. Ensure PostgreSQL is running and accessible');
    console.error('3. Verify your database migrations are up to date');
    console.error('4. Check your internet connection to Stripe API');
    
    process.exit(1);
  }
}

// Gestion de l'arrêt propre du script
process.on('SIGINT', () => {
  console.log('\n⏹️ Script interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️ Script terminated');
  process.exit(0);
});

// Exporter pour utilisation dans d'autres modules
module.exports = {
  syncStripeWithPortall,
  syncDatabasePlans,
  syncStripeProducts,
  validateSynchronization,
  cleanupOrphanedStripeProducts
};

// Exécuter le script si appelé directement
if (require.main === module) {
  main();
}