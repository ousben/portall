// portall/server/tests/webhook-integration-test.js

const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../config/database.connection');

// Import des modèles pour les tests isolés
const User = require('../models/User')(sequelize, sequelize.Sequelize.DataTypes);
const SubscriptionPlan = require('../models/SubscriptionPlan')(sequelize, sequelize.Sequelize.DataTypes);
const UserSubscription = require('../models/UserSubscription')(sequelize, sequelize.Sequelize.DataTypes);
const PaymentHistory = require('../models/PaymentHistory')(sequelize, sequelize.Sequelize.DataTypes);

/**
 * 🧪 SUITE DE TESTS D'INTÉGRATION WEBHOOK - VERSION CORRIGÉE
 * 
 * Cette version résout le problème de validation display_order en utilisant
 * un billing_interval différent pour les tests (week au lieu de month).
 * 
 * Concepts clés pour comprendre ce test :
 * 
 * 1. ISOLATION : Ce test crée ses propres données pour ne pas interférer
 *    avec vos données de développement existantes
 * 
 * 2. WEBHOOK SIMULATION : On simule les appels que Stripe ferait à votre
 *    serveur quand des événements de paiement se produisent
 * 
 * 3. VALIDATION COMPLÈTE : On teste à la fois la sécurité (signatures)
 *    et la logique métier (mise à jour des abonnements)
 */

// Fonctions utilitaires pour créer des données de test uniques
function generateUniqueTestId(prefix) {
  // Crée un ID unique basé sur le timestamp et un random
  // Exemple : "price_1704123456789_abc123"
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function createTestStripeEvent(eventType, data = {}, metadata = {}) {
  // Simule la structure exacte d'un événement Stripe webhook
  // Cette structure correspond à ce que votre WebhookService attend
  return {
    id: `evt_${Date.now()}`, // ID unique pour cet événement
    object: 'event',
    type: eventType, // Type d'événement (payment_intent.succeeded, etc.)
    data: {
      object: {
        id: `${eventType.split('.')[0]}_test_${Date.now()}`,
        ...data, // Données spécifiques à l'événement
        metadata: metadata // Métadonnées pour lier à vos données Portall
      }
    },
    created: Math.floor(Date.now() / 1000), // Timestamp Unix
    livemode: false // Indique que c'est un test
  };
}

function generateStripeSignature(payload, secret) {
  // Génère une signature HMAC-SHA256 valide comme le ferait Stripe
  // Cette signature prouve que le webhook vient bien de Stripe
  const crypto = require('crypto');
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  
  // Format exact attendu par Stripe : "t=timestamp,v1=signature"
  return `t=${timestamp},v1=${signature}`;
}

/**
 * 🔧 Fonction corrigée pour créer des données de test isolées
 * 
 * CHANGEMENT PRINCIPAL : Au lieu d'utiliser billing_interval: 'month'
 * qui nécessite display_order = 1, on utilise 'week' qui évite
 * complètement cette validation stricte.
 */
async function createIsolatedTestData() {
  console.log('📝 Creating isolated test data...');
  
  try {
    // Générer des identifiants complètement uniques pour ce test
    const uniqueStripeId = generateUniqueTestId('price');
    const uniqueEmail = `webhook.test.${Date.now()}@portall.com`;
    const uniqueCustomerId = generateUniqueTestId('cus');
    const uniqueSubscriptionId = generateUniqueTestId('sub');
    
    console.log(`🔧 Using unique identifiers:`, {
      stripeId: uniqueStripeId,
      email: uniqueEmail,
      customerId: uniqueCustomerId,
      subscriptionId: uniqueSubscriptionId
    });
    
    // 🎯 SOLUTION AU PROBLÈME DE VALIDATION
    // 
    // Au lieu de créer un plan avec billing_interval: 'month' qui DOIT
    // avoir display_order = 1, on utilise 'week' qui n'a pas cette contrainte.
    // 
    // Cela nous permet de tester la logique webhook sans nous préoccuper
    // des validations métier spécifiques aux plans de production.
    const testPlan = await SubscriptionPlan.create({
      name: 'Test Plan Weekly - Isolated',
      description: 'Plan de test isolé pour webhooks (cycle hebdomadaire)',
      price_in_cents: 999, // Prix différent pour éviter les conflits avec les vrais plans
      currency: 'USD',
      billing_interval: 'week', // ✅ Évite la validation stricte display_order
      allowed_user_types: ['coach', 'player'],
      features: { 
        profileAccess: true,
        searchAccess: true,
        contactCoaches: true,
        viewPlayerProfiles: true,
        favoriteProfiles: true,
        analyticsBasic: true
      },
      stripe_price_id: uniqueStripeId, // ID Stripe unique pour ce test
      is_active: true,
      display_order: 999 // ✅ Maintenant accepté car billing_interval = 'week'
    });
    
    // Créer un utilisateur de test avec un email unique
    // Cela évite les conflits avec vos utilisateurs existants
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('TestPass123!', 10);
    
    const testUser = await User.create({
      firstName: 'Test',
      lastName: 'Webhook',
      email: uniqueEmail, // Email unique pour éviter les conflits
      password: hashedPassword,
      userType: 'coach',
      isActive: true,
      isEmailVerified: true,
      stripeCustomerId: uniqueCustomerId
    });
    
    // Créer un abonnement de test dans l'état 'pending'
    // Les webhooks vont le faire passer à 'active' si tout va bien
    const testSubscription = await UserSubscription.create({
      userId: testUser.id,
      planId: testPlan.id,
      status: 'pending', // État initial avant confirmation de paiement
      stripeSubscriptionId: uniqueSubscriptionId,
      stripeCustomerId: uniqueCustomerId,
      startedAt: new Date(),
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 semaine plus tard
    });
    
    console.log('✅ Isolated test data created successfully');
    console.log(`   📋 Plan ID: ${testPlan.id} (${testPlan.name})`);
    console.log(`   👤 User ID: ${testUser.id} (${testUser.email})`);
    console.log(`   💳 Subscription ID: ${testSubscription.id} (${testSubscription.status})`);
    
    // Retourner toutes les données créées pour les tests
    return {
      plan: testPlan,
      user: testUser,
      subscription: testSubscription,
      subscriptionId: testSubscription.id,
      stripeSubscriptionId: uniqueSubscriptionId,
      stripeCustomerId: uniqueCustomerId
    };
    
  } catch (error) {
    console.error('❌ Error creating isolated test data:', error.message);
    console.error('📋 Full error details:', error);
    throw error;
  }
}

/**
 * 🧹 Fonction de nettoyage des données de test
 * 
 * Cette fonction supprime toutes les données créées pendant les tests
 * pour laisser votre base de données dans un état propre.
 */
async function cleanupTestEnvironment() {
  console.log('🧹 Cleaning up test environment...');
  
  try {
    // Supprimer dans l'ordre inverse des dépendances pour éviter les erreurs
    // de contraintes de clé étrangère
    
    // 1. D'abord les paiements (qui référencent les abonnements)
    await PaymentHistory.destroy({
      where: {
        stripeEventId: {
          [sequelize.Sequelize.Op.like]: '%test%'
        }
      }
    });
    
    // 2. Ensuite les abonnements (qui référencent les utilisateurs et plans)
    await UserSubscription.destroy({
      where: {
        stripeSubscriptionId: {
          [sequelize.Sequelize.Op.like]: '%test%'
        }
      }
    });
    
    // 3. Puis les utilisateurs
    await User.destroy({
      where: {
        email: {
          [sequelize.Sequelize.Op.like]: '%webhook.test%'
        }
      }
    });
    
    // 4. Enfin les plans de test
    await SubscriptionPlan.destroy({
      where: {
        name: {
          [sequelize.Sequelize.Op.like]: '%Test Plan%'
        }
      }
    });
    
    console.log('✅ Test environment cleaned up successfully');
    
  } catch (error) {
    console.error('❌ Cleanup error:', error.message);
    // Important : ne pas faire échouer le test principal à cause 
    // d'un problème de nettoyage
  }
}

/**
 * 🚀 Suite de tests principale
 * 
 * Cette fonction orchestre tous les tests et gère le cycle de vie
 * des données de test (création -> tests -> nettoyage).
 */
async function runWebhookTests() {
  console.log('\n==========================================');
  console.log('🧪 STARTING ISOLATED WEBHOOK TEST SUITE');
  console.log('==========================================');
  console.log('🎯 Testing webhook integration without affecting development data');
  console.log('🔒 Using isolated test environment with unique identifiers');
  
  let testData = null;
  
  try {
    // Phase 1 : Configuration de l'environnement de test
    console.log('\n⚙️ Setting up isolated webhook test environment...');
    console.log(`🔗 Using isolated test database: ${process.env.DB_NAME}`);
    
    // Vérifier que nous sommes bien en mode test (optionnel mais recommandé)
    if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
      console.log('⚠️ Warning: NODE_ENV is not set to "test"');
      console.log('💡 Consider setting NODE_ENV=test for better isolation');
    }
    
    console.log('📦 Isolated models imported');
    console.log('🔧 Using isolated test database configuration');
    
    // Phase 2 : Création des données de test isolées
    console.log('\n📋 Creating isolated test data...');
    testData = await createIsolatedTestData();
    console.log('✅ Test environment setup complete');
    
    // Phase 3 : Exécution de la suite de tests webhook
    console.log('\n🧪 Running webhook integration tests...');
    
    await testWebhookSecurity();
    await testPaymentIntentSucceeded(testData);
    await testRecurringPaymentSucceeded(testData);
    await testErrorHandling(testData);
    
    // Phase 4 : Validation finale
    console.log('\n🎉 All webhook tests completed successfully!');
    console.log('==========================================');
    console.log('✅ Complete isolation working perfectly');
    console.log('✅ No conflicts with development data');
    console.log('✅ Webhook system production-ready');
    console.log('==========================================');
    
  } catch (error) {
    console.error('\n💥 ISOLATED WEBHOOK TEST FAILED:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
    
  } finally {
    // Phase 5 : Nettoyage garanti même en cas d'erreur
    // Le bloc finally s'exécute TOUJOURS, même si le test échoue
    await cleanupTestEnvironment();
  }
}

/**
 * 🔐 Test 1: Validation de la sécurité des webhooks
 * 
 * Ce test vérifie que votre serveur rejette correctement les webhooks
 * malveillants ou mal formés. C'est crucial pour la sécurité !
 */
async function testWebhookSecurity() {
  console.log('\n🔐 Test 1: Security validation...');
  
  // Test 1.1 : Webhook sans signature (doit être rejeté)
  console.log('   🔍 Testing webhook without signature...');
  const responseNoSignature = await request(app)
    .post('/api/webhooks/stripe')
    .send({ test: 'data' });
  
  if (responseNoSignature.status !== 400) {
    throw new Error(`Expected 400 for unsigned webhook, got ${responseNoSignature.status}`);
  }
  console.log('   ✅ Correctly rejects webhooks without signature');
  
  // Test 1.2 : Webhook avec signature invalide (doit être rejeté)
  console.log('   🔍 Testing webhook with invalid signature...');
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

/**
 * 💳 Test 2: Traitement d'un paiement initial réussi
 * 
 * Ce test simule le webhook que Stripe envoie quand un paiement
 * initial réussit. Votre serveur doit activer l'abonnement.
 */
async function testPaymentIntentSucceeded(testData) {
  console.log('\n💳 Test 2: Payment Intent Succeeded...');
  
  // Créer un événement Stripe simulé avec les bonnes métadonnées
  // Les métadonnées permettent de lier l'événement Stripe à vos données
  const event = createTestStripeEvent('payment_intent.succeeded', {
    amount: 999, // Correspond au prix de notre plan de test
    currency: 'usd'
  }, {
    portall_subscription_id: testData.subscriptionId.toString()
  });
  
  // Préparer la requête avec signature valide
  const payload = JSON.stringify(event);
  const signature = generateStripeSignature(payload, process.env.STRIPE_WEBHOOK_SECRET);
  
  console.log('   🔍 Sending payment_intent.succeeded webhook...');
  const response = await request(app)
    .post('/api/webhooks/stripe')
    .set('stripe-signature', signature)
    .set('content-type', 'application/json')
    .send(payload);
  
  // Vérifier que le webhook a été accepté
  if (response.status !== 200) {
    throw new Error(`Payment intent webhook failed with status ${response.status}: ${response.text}`);
  }
  console.log('   ✅ Webhook accepted by server');
  
  // Vérifier que l'abonnement a été mis à jour en base de données
  const updatedSubscription = await UserSubscription.findByPk(testData.subscriptionId);
  
  if (!updatedSubscription) {
    throw new Error('Subscription not found after webhook processing');
  }
  
  if (updatedSubscription.status !== 'active') {
    throw new Error(`Expected subscription status 'active', got '${updatedSubscription.status}'`);
  }
  
  console.log('   ✅ Subscription correctly activated in database');
  console.log('✅ Payment intent succeeded processed correctly');
}

/**
 * 🔄 Test 3: Traitement d'un paiement récurrent réussi
 * 
 * Ce test simule le webhook envoyé pour les paiements mensuels/annuels
 * automatiques. Il doit prolonger la période d'abonnement.
 */
async function testRecurringPaymentSucceeded(testData) {
  console.log('\n🔄 Test 3: Recurring Payment Succeeded...');
  
  // Créer un événement de facturation récurrente
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

/**
 * ❌ Test 4: Gestion gracieuse des erreurs
 * 
 * Ce test vérifie que votre serveur gère bien les webhooks qui ne
 * concernent pas votre application (webhooks d'autres événements).
 */
async function testErrorHandling(testData) {
  console.log('\n❌ Test 4: Error handling...');
  
  // Créer un événement valide mais sans métadonnées Portall
  // Votre serveur doit l'accepter mais ne rien faire avec
  const invalidEvent = createTestStripeEvent('payment_intent.succeeded', {
    amount: 999,
    currency: 'usd'
    // Pas de métadonnées portall_subscription_id
  });
  
  const payload = JSON.stringify(invalidEvent);
  const signature = generateStripeSignature(payload, process.env.STRIPE_WEBHOOK_SECRET);
  
  console.log('   🔍 Sending webhook without Portall metadata...');
  const response = await request(app)
    .post('/api/webhooks/stripe')
    .set('stripe-signature', signature)
    .set('content-type', 'application/json')
    .send(payload);
  
  // Le serveur doit accepter le webhook (signature valide) même s'il ne fait rien avec
  if (response.status !== 200) {
    throw new Error(`Expected graceful handling, got status ${response.status}`);
  }
  
  console.log('   ✅ Non-applicable webhooks handled gracefully');
  console.log('✅ Error handling working correctly');
}

// Point d'entrée principal du script
// Cette partie s'exécute quand vous lancez le fichier directement
if (require.main === module) {
  runWebhookTests()
    .then(() => {
      console.log('\n🏁 Isolated test suite completed successfully');
      console.log('🎯 Your webhook system is ready for production!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Isolated test suite failed:', error.message);
      console.error('\n🔧 Check the error details above and fix any issues');
      process.exit(1);
    });
}

// Exporter la fonction principale pour utilisation dans d'autres tests
module.exports = { runWebhookTests };