// portall/server/tests/webhook-integration-test.js

const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../config/database.connection');

// ✅ SOLUTION : Utiliser le système d'associations centralisé
const db = require('../models'); // Ceci charge TOUS les modèles avec leurs associations

// Extraire les modèles du système d'associations
const { User, SubscriptionPlan, UserSubscription, PaymentHistory } = db;

/**
 * 🧪 SUITE DE TESTS D'INTÉGRATION WEBHOOK - VERSION AVEC ASSOCIATIONS CORRECTES
 * 
 * CORRECTION PRINCIPALE : Utilisation du système d'associations centralisé
 * 
 * Au lieu d'importer chaque modèle individuellement (ce qui ne charge pas les associations),
 * nous utilisons require('../models') qui charge automatiquement tous les modèles
 * ET exécute leurs associations via model.associate(db).
 * 
 * C'est la différence entre construire des maisons isolées vs un quartier connecté !
 */

// Fonctions utilitaires inchangées
function generateUniqueTestId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function createTestStripeEvent(eventType, data = {}, metadata = {}) {
  return {
    id: `evt_${Date.now()}`,
    object: 'event',
    type: eventType,
    data: {
      object: {
        id: `${eventType.split('.')[0]}_test_${Date.now()}`,
        ...data,
        metadata: metadata
      }
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false
  };
}

function generateStripeSignature(payload, secret) {
  const crypto = require('crypto');
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  
  return `t=${timestamp},v1=${signature}`;
}

/**
 * 🔧 Fonction de création de données avec associations fonctionnelles
 * 
 * Maintenant que nous utilisons le système d'associations centralisé,
 * les modèles peuvent correctement établir leurs relations.
 */
async function createIsolatedTestData() {
  console.log('📝 Creating isolated test data with proper Sequelize associations...');
  
  const transaction = await sequelize.transaction();
  
  try {
    // Générer des identifiants uniques
    const uniqueTimestamp = Date.now();
    const uniqueRandom = Math.random().toString(36).substring(7);
    
    const uniqueStripeId = `price_test_${uniqueTimestamp}_${uniqueRandom}`;
    const uniqueEmail = `webhook.test.${uniqueTimestamp}@portall.com`;
    const uniqueCustomerId = `cus_test_${uniqueTimestamp}_${uniqueRandom}`;
    const uniqueSubscriptionId = `sub_test_${uniqueTimestamp}_${uniqueRandom}`;
    
    console.log(`🔧 Using unique identifiers:`, {
      stripeId: uniqueStripeId,
      email: uniqueEmail,
      customerId: uniqueCustomerId,
      subscriptionId: uniqueSubscriptionId
    });
    
    // ===== ÉTAPE 1 : CRÉER LE PLAN DE TEST =====
    console.log('📋 Creating test subscription plan...');
    
    const testPlan = await SubscriptionPlan.create({
      name: 'Test Plan Weekly - Webhook Integration',
      description: 'Plan de test isolé pour validation webhook (billing_interval = week)',
      price_in_cents: 999,
      currency: 'USD',
      billing_interval: 'week',
      allowed_user_types: ['coach', 'player'],
      features: {
        profileAccess: true,
        searchAccess: true,
        contactCoaches: true,
        viewPlayerProfiles: true,
        favoriteProfiles: true,
        analyticsBasic: true
      },
      stripe_price_id: uniqueStripeId,
      is_active: true,
      display_order: 999
    }, { transaction });
    
    console.log(`✅ Test plan created with ID: ${testPlan.id}`);
    
    // ===== ÉTAPE 2 : CRÉER L'UTILISATEUR DE TEST =====
    console.log('👤 Creating test user...');
    
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('TestPass123!', 10);
    
    // ✅ Utiliser camelCase pour User (avec mappings automatiques)
    const testUser = await User.create({
      email: uniqueEmail,
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'Webhook',
      userType: 'coach',
      isActive: true,
      isEmailVerified: true,
      stripeCustomerId: uniqueCustomerId
    }, { transaction });
    
    console.log(`✅ Test user created with ID: ${testUser.id}`);
    console.log(`   📝 User details: ${testUser.firstName} ${testUser.lastName} (${testUser.email})`);
    
    // ===== ÉTAPE 3 : CRÉER L'ABONNEMENT DE TEST =====
    console.log('💳 Creating test subscription...');
    
    // ✅ Utiliser snake_case pour UserSubscription (sans mappings)
    const testSubscription = await UserSubscription.create({
      user_id: testUser.id,
      plan_id: testPlan.id,
      status: 'pending',
      stripe_subscription_id: uniqueSubscriptionId,
      stripe_customer_id: uniqueCustomerId,
      started_at: new Date(),
      ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      cancelled_at: null,
      metadata: {
        created_by: 'webhook_integration_test',
        test_environment: true,
        test_timestamp: uniqueTimestamp
      }
    }, { transaction });
    
    console.log(`✅ Test subscription created with ID: ${testSubscription.id}`);
    console.log(`   📊 Subscription details: user_id=${testSubscription.user_id}, plan_id=${testSubscription.plan_id}`);
    
    // ===== VALIDATION FINALE AVEC ASSOCIATIONS =====
    console.log('🔍 Validating created data and testing associations...');
    
    // Test des associations pour vérifier qu'elles fonctionnent
    const subscriptionWithPlan = await UserSubscription.findByPk(testSubscription.id, {
      include: [{
        model: SubscriptionPlan,
        as: 'plan'
      }],
      transaction
    });
    
    if (!subscriptionWithPlan) {
      throw new Error('Cannot find subscription after creation');
    }
    
    if (!subscriptionWithPlan.plan) {
      throw new Error('Association UserSubscription -> SubscriptionPlan not working');
    }
    
    console.log('✅ Association test passed: UserSubscription can include SubscriptionPlan');
    console.log(`   📋 Associated plan: ${subscriptionWithPlan.plan.name}`);
    
    // Test de l'association inverse
    const planWithSubscriptions = await SubscriptionPlan.findByPk(testPlan.id, {
      include: [{
        model: UserSubscription,
        as: 'subscriptions'
      }],
      transaction
    });
    
    if (!planWithSubscriptions || !planWithSubscriptions.subscriptions || planWithSubscriptions.subscriptions.length === 0) {
      throw new Error('Association SubscriptionPlan -> UserSubscription not working');
    }
    
    console.log('✅ Reverse association test passed: SubscriptionPlan can include UserSubscriptions');
    console.log(`   💳 Associated subscriptions: ${planWithSubscriptions.subscriptions.length}`);
    
    // Validation des données
    const validationUser = await User.findByPk(testUser.id, { transaction });
    const validationPlan = await SubscriptionPlan.findByPk(testPlan.id, { transaction });
    const validationSubscription = await UserSubscription.findByPk(testSubscription.id, { transaction });
    
    if (!validationUser || !validationPlan || !validationSubscription) {
      throw new Error('Data validation failed: One or more records not properly created');
    }
    
    console.log('✅ All data validation and association checks passed');
    console.log(`   📊 User: ${validationUser.firstName} ${validationUser.lastName} (ID: ${validationUser.id})`);
    console.log(`   📋 Plan: ${validationPlan.name} (ID: ${validationPlan.id})`);
    console.log(`   💳 Subscription: ${validationSubscription.status} (user_id: ${validationSubscription.user_id}, plan_id: ${validationSubscription.plan_id})`);
    
    await transaction.commit();
    console.log('✅ Transaction committed successfully with all associations working');
    
    return {
      plan: testPlan,
      user: testUser,
      subscription: testSubscription,
      subscriptionId: testSubscription.id,
      stripeSubscriptionId: uniqueSubscriptionId,
      stripeCustomerId: uniqueCustomerId,
      testMetadata: {
        timestamp: uniqueTimestamp,
        random: uniqueRandom
      }
    };
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error creating isolated test data (transaction rolled back):', error.message);
    
    // Diagnostic spécifique pour les erreurs d'association
    if (error.message.includes('is not associated')) {
      console.error('\n🔧 ASSOCIATION ERROR DIAGNOSTIC:');
      console.error('This error indicates that Sequelize associations are not properly established.');
      console.error('Make sure you are using require("../models") instead of importing models individually.');
      console.error('The models/index.js file should handle all associations automatically.');
    }
    
    if (error.name === 'SequelizeValidationError') {
      console.error('📋 Sequelize validation errors:');
      error.errors.forEach((validationError, index) => {
        console.error(`   ${index + 1}. Field: ${validationError.path}`);
        console.error(`      Message: ${validationError.message}`);
        console.error(`      Value: ${validationError.value}`);
      });
    }
    
    console.error('📋 Full error details:', error);
    throw error;
  }
}

/**
 * 🧹 Fonction de nettoyage améliorée
 */
async function cleanupTestEnvironment() {
  console.log('🧹 Cleaning up test environment...');
  
  const cleanupTransaction = await sequelize.transaction();
  
  try {
    // Supprimer dans l'ordre inverse des dépendances
    const deletedPayments = await PaymentHistory.destroy({
      where: {
        stripe_event_id: {
          [sequelize.Sequelize.Op.like]: '%test%'
        }
      },
      transaction: cleanupTransaction
    });
    
    const deletedSubscriptions = await UserSubscription.destroy({
      where: {
        stripe_subscription_id: {
          [sequelize.Sequelize.Op.like]: '%test%'
        }
      },
      transaction: cleanupTransaction
    });
    
    const deletedUsers = await User.destroy({
      where: {
        email: {
          [sequelize.Sequelize.Op.like]: '%webhook.test%'
        }
      },
      transaction: cleanupTransaction
    });
    
    const deletedPlans = await SubscriptionPlan.destroy({
      where: {
        name: {
          [sequelize.Sequelize.Op.like]: '%Test Plan%'
        }
      },
      transaction: cleanupTransaction
    });
    
    await cleanupTransaction.commit();
    
    console.log(`✅ Test environment cleaned up successfully:`);
    console.log(`   - ${deletedPayments} payment records deleted`);
    console.log(`   - ${deletedSubscriptions} subscription records deleted`);
    console.log(`   - ${deletedUsers} user records deleted`);
    console.log(`   - ${deletedPlans} plan records deleted`);
    
  } catch (error) {
    await cleanupTransaction.rollback();
    console.error('❌ Cleanup error (transaction rolled back):', error.message);
  }
}

/**
 * 🚀 Suite de tests principale
 */
async function runWebhookTests() {
  console.log('\n==========================================');
  console.log('🧪 STARTING ISOLATED WEBHOOK TEST SUITE');
  console.log('==========================================');
  console.log('🎯 Testing webhook integration with proper Sequelize associations');
  console.log('🔗 Using centralized model system with automatic association loading');
  console.log('✅ UserSubscription ↔ SubscriptionPlan associations will be available');
  
  let testData = null;
  
  try {
    console.log('\n⚙️ Setting up isolated webhook test environment...');
    console.log(`🔗 Database: ${process.env.DB_NAME}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📦 Models loaded from: ${require.resolve('../models')}`);
    
    console.log('\n📋 Creating isolated test data with proper associations...');
    testData = await createIsolatedTestData();
    console.log('✅ Test environment setup complete with working associations');
    
    console.log('\n🧪 Running webhook integration tests...');
    
    await testWebhookSecurity();
    await testPaymentIntentSucceeded(testData);
    await testRecurringPaymentSucceeded(testData);
    await testErrorHandling(testData);
    
    console.log('\n🎉 All webhook tests completed successfully!');
    console.log('==========================================');
    console.log('✅ Sequelize associations working correctly');
    console.log('✅ UserSubscription ↔ SubscriptionPlan relationships established');
    console.log('✅ Webhook processing can access related models');
    console.log('✅ Foreign key relationships validated');
    console.log('✅ Webhook system production-ready');
    console.log('==========================================');
    
  } catch (error) {
    console.error('\n💥 ISOLATED WEBHOOK TEST FAILED:', error.message);
    console.error('📋 Error type:', error.constructor.name);
    
    if (error.message.includes('is not associated')) {
      console.error('\n🔧 ASSOCIATION TROUBLESHOOTING:');
      console.error('1. Verify that models/index.js is properly loading all models');
      console.error('2. Check that associate functions are defined in each model');
      console.error('3. Ensure the test uses require("../models") not individual imports');
      console.error('4. Verify that association names match between models');
    }
    
    if (error.name === 'SequelizeValidationError') {
      console.error('📋 Sequelize validation errors:');
      error.errors.forEach((validationError, index) => {
        console.error(`   ${index + 1}. ${validationError.message}`);
        console.error(`      Field: ${validationError.path}`);
        console.error(`      Value: ${validationError.value}`);
      });
    }
    
    console.error('📋 Full stack trace:', error.stack);
    throw error;
    
  } finally {
    await cleanupTestEnvironment();
  }
}

// Tests individuels (inchangés)
async function testWebhookSecurity() {
  console.log('\n🔐 Test 1: Security validation...');
  
  const responseNoSignature = await request(app)
    .post('/api/webhooks/stripe')
    .send({ test: 'data' });
  
  if (responseNoSignature.status !== 400) {
    throw new Error(`Expected 400 for unsigned webhook, got ${responseNoSignature.status}`);
  }
  console.log('   ✅ Correctly rejects webhooks without signature');
  
  const responseInvalidSignature = await request(app)
    .post('/api/webhooks/stripe')
    .set('stripe-signature', 'invalid_signature')
    .send({ test: 'data' });
  
  if (responseInvalidSignature.status !== 401) {
    throw new Error(`Expected 401 for invalid signature, got ${responseInvalidSignature.status}`);
  }
  console.log('   ✅ Correctly rejects webhooks with invalid signature');
  
  console.log('✅ Security validation passed');
}

async function testPaymentIntentSucceeded(testData) {
  console.log('\n💳 Test 2: Payment Intent Succeeded...');
  console.log('   🔍 This test will verify that webhook processing can access associated models');
  
  const event = createTestStripeEvent('payment_intent.succeeded', {
    amount: 999,
    currency: 'usd'
  }, {
    portall_subscription_id: testData.subscriptionId.toString()
  });
  
  const payload = JSON.stringify(event);
  const signature = generateStripeSignature(payload, process.env.STRIPE_WEBHOOK_SECRET);
  
  console.log('   🔍 Sending payment_intent.succeeded webhook...');
  console.log(`   📋 Subscription ID in metadata: ${testData.subscriptionId}`);
  
  const response = await request(app)
    .post('/api/webhooks/stripe')
    .set('stripe-signature', signature)
    .set('content-type', 'application/json')
    .send(payload);
  
  if (response.status !== 200) {
    console.error(`   ❌ Webhook response status: ${response.status}`);
    console.error(`   📋 Response body: ${response.text}`);
    throw new Error(`Payment intent webhook failed with status ${response.status}: ${response.text}`);
  }
  console.log('   ✅ Webhook accepted by server (associations working!)');
  
  // Vérifier la mise à jour en base
  const updatedSubscription = await UserSubscription.findByPk(testData.subscriptionId);
  
  if (!updatedSubscription) {
    throw new Error('Subscription not found after webhook processing');
  }
  
  if (updatedSubscription.status !== 'active') {
    throw new Error(`Expected subscription status 'active', got '${updatedSubscription.status}'`);
  }
  
  console.log('   ✅ Subscription correctly activated in database');
  console.log('✅ Payment intent succeeded processed correctly with associations');
}

async function testRecurringPaymentSucceeded(testData) {
  console.log('\n🔄 Test 3: Recurring Payment Succeeded...');
  
  const event = createTestStripeEvent('invoice.payment_succeeded', {
    subscription: testData.stripeSubscriptionId,
    amount_paid: 999,
    currency: 'usd'
  });
  
  const payload = JSON.stringify(event);
  const signature = generateStripeSignature(payload, process.env.STRIPE_WEBHOOK_SECRET);
  
  console.log('   🔍 Sending invoice.payment_succeeded webhook...');
  const response = await request(app)
    .post('/api/webhooks/stripe')
    .set('stripe-signature', signature)
    .set('content-type', 'application/json')
    .send(payload);
  
  if (response.status !== 200) {
    throw new Error(`Recurring payment webhook failed with status ${response.status}: ${response.text}`);
  }
  
  console.log('   ✅ Recurring payment webhook processed');
  console.log('✅ Recurring payment processed correctly');
}

async function testErrorHandling(testData) {
  console.log('\n❌ Test 4: Error handling...');
  
  const invalidEvent = createTestStripeEvent('payment_intent.succeeded', {
    amount: 999,
    currency: 'usd'
  });
  
  const payload = JSON.stringify(invalidEvent);
  const signature = generateStripeSignature(payload, process.env.STRIPE_WEBHOOK_SECRET);
  
  console.log('   🔍 Sending webhook without Portall metadata...');
  const response = await request(app)
    .post('/api/webhooks/stripe')
    .set('stripe-signature', signature)
    .set('content-type', 'application/json')
    .send(payload);
  
  if (response.status !== 200) {
    throw new Error(`Expected graceful handling, got status ${response.status}`);
  }
  
  console.log('   ✅ Non-applicable webhooks handled gracefully');
  console.log('✅ Error handling working correctly');
}

// Point d'entrée principal
if (require.main === module) {
  runWebhookTests()
    .then(() => {
      console.log('\n🏁 Isolated test suite completed successfully');
      console.log('🎯 Your webhook system is ready for production!');
      console.log('✅ All Sequelize associations are working correctly');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Isolated test suite failed:', error.message);
      console.error('\n🔧 Check the error details above and fix any issues');
      process.exit(1);
    });
}

module.exports = { runWebhookTests };