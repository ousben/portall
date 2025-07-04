// portall/server/config/stripe.js

/**
 * Configuration Stripe pour Portall
 * 
 * Ce fichier centralise toute la configuration Stripe et explique
 * les concepts importants pour un développeur débutant avec les paiements.
 * 
 * Concepts clés à retenir :
 * 
 * 1. CLÉS API : Stripe utilise deux paires de clés
 *    - Clés de TEST (sk_test_, pk_test_) : pour le développement
 *    - Clés de PRODUCTION (sk_live_, pk_live_) : pour les vrais paiements
 * 
 * 2. WEBHOOKS : Stripe envoie des notifications HTTP à votre serveur
 *    pour vous informer des événements (paiement réussi, échec, etc.)
 * 
 * 3. IDEMPOTENCE : Stripe garantit qu'un même paiement ne peut pas
 *    être traité plusieurs fois accidentellement
 */

const stripe = require('stripe');

// Validation des variables d'environnement requises
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set - webhooks will not work');
}

// Initialisation de l'instance Stripe
const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', // Utiliser une version API fixe pour la stabilité
  typescript: false,
  timeout: 20000, // 20 secondes de timeout
  maxNetworkRetries: 3, // Retry automatique en cas de problème réseau
});

/**
 * Configuration des plans Portall
 * 
 * Ces objets définissent la structure de vos produits et prix chez Stripe.
 * Ils correspondent exactement à vos modèles de base de données.
 */
const PORTALL_PLANS = {
  monthly: {
    name: 'Portall Monthly',
    description: 'Accès complet à la plateforme Portall avec facturation mensuelle',
    price_in_cents: 2999, // 29.99 USD
    interval: 'month',
    display_order: 1
  },
  yearly: {
    name: 'Portall Yearly',
    description: 'Accès complet à la plateforme Portall avec facturation annuelle - Économisez plus de 70% !',
    price_in_cents: 7999, // 79.99 USD  
    interval: 'year',
    display_order: 2
  }
};

/**
 * Configuration des webhooks
 * 
 * Les webhooks sont essentiels pour maintenir votre application synchronisée
 * avec Stripe. Voici les événements qui nous intéressent pour Portall :
 */
const WEBHOOK_EVENTS = [
  'invoice.payment_succeeded',     // Paiement récurrent réussi
  'invoice.payment_failed',        // Paiement récurrent échoué
  'customer.subscription.created', // Nouvel abonnement créé
  'customer.subscription.updated', // Abonnement modifié
  'customer.subscription.deleted', // Abonnement annulé
  'payment_intent.succeeded',      // Paiement ponctuel réussi
  'payment_intent.payment_failed', // Paiement ponctuel échoué
];

/**
 * Fonctions utilitaires pour Stripe
 */

/**
 * Créer un produit et ses prix chez Stripe
 * 
 * Cette fonction sera appelée lors de l'initialisation pour synchroniser
 * vos plans de base de données avec Stripe.
 */
async function createStripeProduct(planConfig) {
  try {
    console.log(`🏗️ Creating Stripe product: ${planConfig.name}`);
    
    // Créer le produit principal
    const product = await stripeInstance.products.create({
      name: planConfig.name,
      description: planConfig.description,
      metadata: {
        portall_plan_type: planConfig.interval,
        created_by: 'portall_setup'
      }
    });

    console.log(`✅ Product created: ${product.id}`);

    // Créer le prix associé
    const price = await stripeInstance.prices.create({
      unit_amount: planConfig.price_in_cents,
      currency: 'usd',
      recurring: {
        interval: planConfig.interval
      },
      product: product.id,
      metadata: {
        portall_plan_type: planConfig.interval,
        display_order: planConfig.display_order
      }
    });

    console.log(`✅ Price created: ${price.id}`);

    return {
      product_id: product.id,
      price_id: price.id,
      plan_config: planConfig
    };

  } catch (error) {
    console.error(`❌ Error creating Stripe product for ${planConfig.name}:`, error.message);
    throw error;
  }
}

/**
 * Synchroniser tous les plans Portall avec Stripe
 * 
 * Cette fonction sera appelée au démarrage pour s'assurer que vos plans
 * locaux correspondent exactement à ce qui existe chez Stripe.
 */
async function syncPortallPlansWithStripe() {
  console.log('🔄 Synchronizing Portall plans with Stripe...');
  
  const results = [];
  
  for (const [planKey, planConfig] of Object.entries(PORTALL_PLANS)) {
    try {
      const result = await createStripeProduct(planConfig);
      results.push({
        plan_key: planKey,
        ...result
      });
    } catch (error) {
      console.error(`❌ Failed to sync plan ${planKey}:`, error.message);
    }
  }
  
  console.log(`✅ Synced ${results.length} plans with Stripe`);
  return results;
}

/**
 * Valider la signature d'un webhook Stripe
 * 
 * Cette fonction vérifie que le webhook provient réellement de Stripe
 * et n'est pas un appel malveillant.
 */
function validateWebhookSignature(payload, signature) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  try {
    return stripeInstance.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('❌ Webhook signature validation failed:', error.message);
    throw new Error('Invalid webhook signature');
  }
}

/**
 * Créer un client Stripe pour un utilisateur Portall
 * 
 * Chaque utilisateur Portall aura un correspondant "Customer" chez Stripe.
 * Cela permet de gérer les méthodes de paiement, l'historique, etc.
 */
async function createStripeCustomer(user) {
  try {
    const customer = await stripeInstance.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: {
        portall_user_id: user.id,
        portall_user_type: user.userType,
        created_at: new Date().toISOString()
      }
    });

    console.log(`✅ Stripe customer created: ${customer.id} for user ${user.id}`);
    return customer;

  } catch (error) {
    console.error(`❌ Error creating Stripe customer for user ${user.id}:`, error.message);
    throw error;
  }
}

// Export de tous les éléments nécessaires
module.exports = {
  stripe: stripeInstance,
  PORTALL_PLANS,
  WEBHOOK_EVENTS,
  createStripeProduct,
  syncPortallPlansWithStripe,
  validateWebhookSignature,
  createStripeCustomer
};