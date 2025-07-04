// portall/server/controllers/subscriptionController.js

/**
 * Contrôleur des abonnements Portall
 * 
 * Ce contrôleur est le "chef d'orchestre" de votre système de paiement.
 * Il coordonne les interactions entre votre base de données locale,
 * Stripe, et vos utilisateurs.
 * 
 * Architecture en couches que nous respectons :
 * 1. Routes -> 2. Controller -> 3. Services -> 4. Models -> 5. Database -> 6. Stripe API
 *
 * 
 * Chaque méthode de ce contrôleur suit le même pattern :
 * - Validation des données d'entrée
 * - Authentification et autorisation
 * - Logique métier principale
 * - Gestion d'erreur robuste
 * - Réponse formatée pour le frontend
 */

const { stripe, createStripeCustomer } = require('../config/stripe');
const { sequelize } = require('../config/database.connection');

// Import des modèles - nous utilisons l'instance sequelize directement
const User = require('../models/User')(sequelize, sequelize.Sequelize.DataTypes);
const SubscriptionPlan = require('../models/SubscriptionPlan')(sequelize, sequelize.Sequelize.DataTypes);
const UserSubscription = require('../models/UserSubscription')(sequelize, sequelize.Sequelize.DataTypes);
const PaymentHistory = require('../models/PaymentHistory')(sequelize, sequelize.Sequelize.DataTypes);

/**
 * GET /api/subscriptions/plans
 * 
 * Récupère tous les plans d'abonnement disponibles
 * 
 * Cette route est publique (pas d'authentification requise) car elle permet
 * aux visiteurs de voir les tarifs avant de s'inscrire. C'est votre "vitrine".
 */
const getAvailablePlans = async (req, res) => {
  try {
    console.log('📋 Fetching available subscription plans...');

    // Récupérer tous les plans actifs avec leurs informations d'affichage
    const plans = await SubscriptionPlan.findAll({
      where: {
        is_active: true
      },
      order: [['display_order', 'ASC']],
      attributes: [
        'id',
        'name', 
        'description',
        'price_in_cents',
        'currency',
        'billing_interval',
        'features',
        'display_order',
        'stripe_price_id'
      ]
    });

    // Transformer les données pour un affichage optimal
    const formattedPlans = plans.map(plan => {
      const baseInfo = {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: (plan.price_in_cents / 100).toFixed(2),
        currency: plan.currency,
        interval: plan.billing_interval,
        intervalDisplay: plan.billing_interval === 'month' ? 'par mois' : 'par an',
        features: plan.features,
        stripeId: plan.stripe_price_id,
        recommended: false // Par défaut
      };

      // Calculer les économies pour le plan annuel
      if (plan.billing_interval === 'year') {
        const monthlyPrice = 29.99;
        const yearlyPrice = plan.price_in_cents / 100;
        const monthlyYearlyEquivalent = monthlyPrice * 12;
        const savings = monthlyYearlyEquivalent - yearlyPrice;
        
        baseInfo.savings = {
          amount: savings,
          percentage: Math.round((savings / monthlyYearlyEquivalent) * 100),
          formatted: `$${savings.toFixed(2)}`
        };
        baseInfo.recommended = true; // Le plan annuel est recommandé
        baseInfo.badge = `Économisez ${baseInfo.savings.formatted}`;
      }

      return baseInfo;
    });

    console.log(`✅ Retrieved ${formattedPlans.length} available plans`);

    res.json({
      status: 'success',
      message: 'Plans retrieved successfully',
      data: {
        plans: formattedPlans,
        totalPlans: formattedPlans.length,
        currency: 'USD'
      }
    });

  } catch (error) {
    console.error('❌ Error fetching subscription plans:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Unable to retrieve subscription plans',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * POST /api/subscriptions/create
 * 
 * Crée un nouvel abonnement pour l'utilisateur authentifié
 * 
 * Cette route est le cœur de votre système de paiement. Elle coordonne :
 * 1. La création du Customer Stripe
 * 2. La création du PaymentIntent
 * 3. L'enregistrement de l'abonnement en base
 * 4. Le suivi de la transaction
 */
const createSubscription = async (req, res) => {
  // Utilisation d'une transaction de base de données pour la cohérence
  const transaction = await sequelize.transaction();
  
  try {
    const { planId, paymentMethodId } = req.body;
    const userId = req.user.id; // Vient du middleware d'authentification

    console.log(`💳 Creating subscription for user ${userId}, plan ${planId}`);

    // ================================
    // ÉTAPE 1: VALIDATIONS PRÉLIMINAIRES
    // ================================

    // Vérifier que l'utilisateur n'a pas déjà un abonnement actif
    const existingSubscription = await UserSubscription.findOne({
      where: {
        user_id: userId,
        status: ['active', 'pending']
      },
      transaction
    });

    if (existingSubscription) {
      await transaction.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'User already has an active subscription',
        code: 'EXISTING_SUBSCRIPTION'
      });
    }

    // Récupérer le plan choisi
    const selectedPlan = await SubscriptionPlan.findOne({
      where: {
        id: planId,
        is_active: true
      },
      transaction
    });

    if (!selectedPlan) {
      await transaction.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Selected plan not found or inactive',
        code: 'PLAN_NOT_FOUND'
      });
    }

    // Récupérer les informations utilisateur
    const user = await User.findByPk(userId, { transaction });

    // ================================
    // ÉTAPE 2: GESTION DU CUSTOMER STRIPE
    // ================================

    let stripeCustomerId = null;

    // Vérifier si l'utilisateur a déjà un Customer Stripe
    const existingCustomer = await UserSubscription.findOne({
      where: { user_id: userId },
      attributes: ['stripe_customer_id'],
      transaction
    });

    if (existingCustomer && existingCustomer.stripe_customer_id) {
      stripeCustomerId = existingCustomer.stripe_customer_id;
      console.log(`♻️ Using existing Stripe customer: ${stripeCustomerId}`);
    } else {
      // Créer un nouveau Customer Stripe
      console.log('👤 Creating new Stripe customer...');
      const stripeCustomer = await createStripeCustomer(user);
      stripeCustomerId = stripeCustomer.id;
      console.log(`✅ Created Stripe customer: ${stripeCustomerId}`);
    }

    // ================================
    // ÉTAPE 3: CRÉATION DE L'ABONNEMENT EN BASE
    // ================================

    console.log('📝 Creating subscription record in database...');

    const newSubscription = await UserSubscription.create({
      user_id: userId,
      plan_id: selectedPlan.id,
      status: 'pending',
      stripe_customer_id: stripeCustomerId,
      metadata: {
        created_from: 'web_app',
        user_agent: req.get('User-Agent'),
        ip_address: req.ip,
        plan_selected: selectedPlan.name
      }
    }, { transaction });

    // ================================
    // ÉTAPE 4: CRÉATION DU PAYMENTINTENT STRIPE
    // ================================

    console.log('💰 Creating Stripe PaymentIntent...');

    const paymentIntent = await stripe.paymentIntents.create({
      amount: selectedPlan.price_in_cents,
      currency: selectedPlan.currency.toLowerCase(),
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${process.env.FRONTEND_URL}/subscription/success`,
      metadata: {
        portall_subscription_id: newSubscription.id.toString(),
        portall_user_id: userId.toString(),
        portall_plan_name: selectedPlan.name,
        billing_interval: selectedPlan.billing_interval
      }
    });

    // ================================
    // ÉTAPE 5: ENREGISTREMENT DE LA TRANSACTION
    // ================================

    console.log('📊 Recording payment transaction...');

    const paymentRecord = await PaymentHistory.create({
      subscription_id: newSubscription.id,
      stripe_payment_intent_id: paymentIntent.id,
      amount_in_cents: selectedPlan.price_in_cents,
      currency: selectedPlan.currency,
      status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
      payment_type: 'initial',
      payment_method: paymentIntent.payment_method_types[0],
      processed_at: paymentIntent.status === 'succeeded' ? new Date() : null,
      metadata: {
        stripe_payment_intent_status: paymentIntent.status,
        confirmation_method: paymentIntent.confirmation_method
      }
    }, { transaction });

    // ================================
    // ÉTAPE 6: ACTIVATION SI PAIEMENT RÉUSSI
    // ================================

    if (paymentIntent.status === 'succeeded') {
      console.log('🎉 Payment succeeded, activating subscription...');

      // Calculer la date de fin selon l'intervalle
      const endsAt = new Date();
      if (selectedPlan.billing_interval === 'month') {
        endsAt.setMonth(endsAt.getMonth() + 1);
      } else {
        endsAt.setFullYear(endsAt.getFullYear() + 1);
      }

      // Activer l'abonnement
      await newSubscription.update({
        status: 'active',
        started_at: new Date(),
        ends_at: endsAt
      }, { transaction });

      // Créer l'abonnement récurrent chez Stripe pour les futurs paiements
      const stripeSubscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: selectedPlan.stripe_price_id }],
        metadata: {
          portall_subscription_id: newSubscription.id.toString(),
          portall_user_id: userId.toString()
        }
      });

      await newSubscription.update({
        stripe_subscription_id: stripeSubscription.id
      }, { transaction });
    }

    // Valider la transaction de base de données
    await transaction.commit();

    console.log(`✅ Subscription creation completed for user ${userId}`);

    // ================================
    // RÉPONSE AU CLIENT
    // ================================

    const response = {
      status: 'success',
      message: paymentIntent.status === 'succeeded' ? 
        'Subscription activated successfully' : 
        'Payment requires additional authentication',
      data: {
        subscriptionId: newSubscription.id,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          clientSecret: paymentIntent.client_secret
        },
        subscription: {
          status: newSubscription.status,
          plan: {
            name: selectedPlan.name,
            price: (selectedPlan.price_in_cents / 100).toFixed(2),
            interval: selectedPlan.billing_interval
          }
        }
      }
    };

    res.status(201).json(response);

  } catch (error) {
    // Annuler la transaction en cas d'erreur
    await transaction.rollback();
    
    console.error('❌ Error creating subscription:', error);

    // Gestion d'erreur spécifique selon le type d'erreur Stripe
    let errorMessage = 'Failed to create subscription';
    let statusCode = 500;

    if (error.type === 'StripeCardError') {
      errorMessage = 'Payment failed: ' + error.message;
      statusCode = 400;
    } else if (error.type === 'StripeInvalidRequestError') {
      errorMessage = 'Invalid payment information';
      statusCode = 400;
    }

    res.status(statusCode).json({
      status: 'error',
      message: errorMessage,
      code: error.code || 'SUBSCRIPTION_CREATION_FAILED',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/subscriptions/my-subscription
 * 
 * Récupère l'abonnement actuel de l'utilisateur authentifié
 * 
 * Cette route permet à l'utilisateur de consulter l'état de son abonnement,
 * ses paiements, et de gérer son compte.
 */
const getMySubscription = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`📊 Fetching subscription for user ${userId}`);

    // Récupérer l'abonnement avec toutes les informations liées
    const subscription = await UserSubscription.findOne({
      where: {
        user_id: userId
      },
      include: [
        {
          model: SubscriptionPlan,
          as: 'plan',
          attributes: ['id', 'name', 'description', 'price_in_cents', 'currency', 'billing_interval', 'features']
        }
      ],
      order: [['created_at', 'DESC']] // Le plus récent en premier
    });

    if (!subscription) {
      return res.json({
        status: 'success',
        message: 'No subscription found',
        data: {
          hasSubscription: false,
          subscription: null
        }
      });
    }

    // Récupérer l'historique des paiements
    const paymentHistory = await PaymentHistory.findAll({
      where: {
        subscription_id: subscription.id
      },
      order: [['created_at', 'DESC']],
      limit: 10 // Les 10 derniers paiements
    });

    // Formater les données pour le frontend
    const formattedSubscription = {
      id: subscription.id,
      status: subscription.status,
      startedAt: subscription.started_at,
      endsAt: subscription.ends_at,
      cancelledAt: subscription.cancelled_at,
      isActive: subscription.isActive(),
      daysRemaining: subscription.getDaysRemaining(),
      isExpiringSoon: subscription.isExpiringSoon(),
      plan: subscription.plan ? {
        id: subscription.plan.id,
        name: subscription.plan.name,
        description: subscription.plan.description,
        price: (subscription.plan.price_in_cents / 100).toFixed(2),
        currency: subscription.plan.currency,
        interval: subscription.plan.billing_interval,
        features: subscription.plan.features
      } : null,
      paymentHistory: paymentHistory.map(payment => ({
        id: payment.id,
        amount: (payment.amount_in_cents / 100).toFixed(2),
        currency: payment.currency,
        status: payment.status,
        paymentType: payment.payment_type,
        processedAt: payment.processed_at,
        createdAt: payment.created_at
      }))
    };

    console.log(`✅ Retrieved subscription data for user ${userId}`);

    res.json({
      status: 'success',
      message: 'Subscription retrieved successfully',
      data: {
        hasSubscription: true,
        subscription: formattedSubscription
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user subscription:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Unable to retrieve subscription information',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * POST /api/subscriptions/cancel
 * 
 * Annule l'abonnement de l'utilisateur authentifié
 * 
 * L'annulation suit une logique métier importante :
 * - L'utilisateur garde l'accès jusqu'à la fin de sa période payée
 * - L'abonnement récurrent chez Stripe est annulé
 * - Un enregistrement d'audit est créé
 */
const cancelSubscription = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { reason } = req.body; // Raison optionnelle de l'annulation

    console.log(`🚫 Cancelling subscription for user ${userId}`);

    // Récupérer l'abonnement actif
    const subscription = await UserSubscription.findOne({
      where: {
        user_id: userId,
        status: 'active'
      },
      include: [
        {
          model: SubscriptionPlan,
          as: 'plan'
        }
      ],
      transaction
    });

    if (!subscription) {
      await transaction.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'No active subscription found to cancel',
        code: 'NO_ACTIVE_SUBSCRIPTION'
      });
    }

    // Annuler l'abonnement récurrent chez Stripe
    if (subscription.stripe_subscription_id) {
      console.log(`🔄 Cancelling Stripe subscription: ${subscription.stripe_subscription_id}`);
      
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
        metadata: {
          cancelled_by_user: 'true',
          cancellation_reason: reason || 'user_requested',
          cancelled_at: new Date().toISOString()
        }
      });
    }

    // Mettre à jour l'abonnement en base
    await subscription.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      metadata: {
        ...subscription.metadata,
        cancellation_reason: reason || 'user_requested',
        cancelled_by: 'user',
        original_ends_at: subscription.ends_at
      }
    }, { transaction });

    // Enregistrer l'événement d'annulation
    await PaymentHistory.create({
      subscription_id: subscription.id,
      amount_in_cents: 0, // Pas de montant pour une annulation
      currency: subscription.plan.currency,
      status: 'cancelled',
      payment_type: 'cancellation',
      processed_at: new Date(),
      metadata: {
        cancellation_reason: reason || 'user_requested',
        access_until: subscription.ends_at
      }
    }, { transaction });

    await transaction.commit();

    console.log(`✅ Subscription cancelled for user ${userId}`);

    res.json({
      status: 'success',
      message: 'Subscription cancelled successfully',
      data: {
        subscription: {
          id: subscription.id,
          status: 'cancelled',
          cancelledAt: subscription.cancelled_at,
          accessUntil: subscription.ends_at,
          plan: {
            name: subscription.plan.name,
            interval: subscription.plan.billing_interval
          }
        },
        accessDetails: {
          hasAccess: true,
          accessUntil: subscription.ends_at,
          daysRemaining: subscription.getDaysRemaining(),
          message: `Vous conservez l'accès à Portall jusqu'au ${subscription.ends_at.toLocaleDateString()}`
        }
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error cancelling subscription:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Export de toutes les méthodes du contrôleur
module.exports = {
  getAvailablePlans,
  createSubscription,
  getMySubscription,
  cancelSubscription
};