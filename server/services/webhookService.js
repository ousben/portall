// portall/server/services/webhookService.js

/**
 * Service de gestion des webhooks Stripe pour Portall
 * 
 * Ce service est le "traducteur" entre Stripe et votre application Portall.
 * Quand Stripe veut vous dire "un paiement a réussi" ou "un abonnement a été annulé",
 * il envoie un webhook à ce service qui traduit cette information en actions
 * concrètes dans votre base de données.
 * 
 * CHANGEMENT PRINCIPAL DANS CETTE VERSION :
 * Nous utilisons maintenant le système d'associations Sequelize au lieu d'importer
 * chaque modèle séparément. C'est comme prendre un kit LEGO complet avec 
 * les instructions d'assemblage, au lieu d'acheter chaque pièce individuellement.
 */

const { sequelize } = require('../config/database.connection');
const { stripe, validateWebhookSignature } = require('../config/stripe');

// ✅ CHANGEMENT CRITIQUE : Au lieu d'importer chaque modèle séparément...
// const User = require('../models/User')(sequelize, sequelize.Sequelize.DataTypes);
// const SubscriptionPlan = require('../models/SubscriptionPlan')(sequelize, sequelize.Sequelize.DataTypes);
// ... (ce qui cassait les associations)

// ✅ NOUVELLE APPROCHE : Nous importons le système complet avec toutes les connexions
const db = require('../models'); // Ceci charge TOUS les modèles ET leurs relations

// Maintenant nous extrayons les modèles qui ont leurs associations fonctionnelles
const { User, SubscriptionPlan, UserSubscription, PaymentHistory } = db;

/**
 * Classe principale qui gère tous les webhooks de Stripe
 * 
 * Cette classe suit un pattern simple : pour chaque type d'événement Stripe,
 * nous avons une méthode spécialisée qui sait exactement quoi faire.
 * C'est comme avoir un réceptionniste expert qui sait vers quel département
 * diriger chaque type de visiteur.
 */
class WebhookService {

  /**
   * Méthode principale : traite n'importe quel webhook de Stripe
   * 
   * Cette méthode fait trois choses importantes :
   * 1. Vérifie que le webhook vient vraiment de Stripe (sécurité)
   * 2. Détermine quel type d'événement c'est
   * 3. Appelle la bonne méthode pour le traiter
   * 
   * Pensez à cela comme le bureau d'accueil d'un hôpital : il reçoit tous
   * les patients, vérifie leur identité, et les dirige vers le bon service.
   */
  async processWebhook(payload, signature) {
    console.log('🎣 Début du traitement du webhook...');
    
    try {
      // Étape 1 : Vérifier que ce webhook vient vraiment de Stripe
      // (comme vérifier une pièce d'identité)
      const event = validateWebhookSignature(payload, signature);
      console.log(`📨 Traitement de l'événement : ${event.type} (ID: ${event.id})`);
      
      // Étape 2 : Traiter l'événement dans une transaction de base de données
      // Une transaction garantit que soit tout réussit, soit rien ne change
      // C'est comme un contrat : soit toutes les conditions sont remplies, soit on annule tout
      const result = await sequelize.transaction(async (transaction) => {
        return await this.routeEvent(event, transaction);
      });
      
      console.log('✅ Webhook traité avec succès :', result);
      return { status: 'success', result };
      
    } catch (error) {
      console.error('❌ Erreur lors du traitement du webhook :', error.message);
      throw error;
    }
  }

  /**
   * Méthode qui décide quel processeur utiliser selon le type d'événement
   * 
   * C'est comme un aiguilleur de train : selon la destination (type d'événement),
   * il dirige vers la bonne voie (méthode de traitement).
   */
  async routeEvent(event, transaction) {
    console.log(`🔀 Redirection de l'événement : ${event.type}`);
    
    // Dictionnaire qui associe chaque type d'événement à sa méthode de traitement
    const eventHandlers = {
      // Événements de paiement ponctuel
      'payment_intent.succeeded': () => this.handlePaymentIntentSucceeded(event, transaction),
      'payment_intent.payment_failed': () => this.handlePaymentIntentFailed(event, transaction),
      
      // Événements de facturation récurrente (abonnements)
      'invoice.payment_succeeded': () => this.handleInvoicePaymentSucceeded(event, transaction),
      'invoice.payment_failed': () => this.handleInvoicePaymentFailed(event, transaction),
      
      // Événements d'abonnement Stripe
      'customer.subscription.created': () => this.handleSubscriptionCreated(event, transaction),
      'customer.subscription.updated': () => this.handleSubscriptionUpdated(event, transaction),
      'customer.subscription.deleted': () => this.handleSubscriptionDeleted(event, transaction),
    };
    
    // Chercher le bon gestionnaire pour ce type d'événement
    const handler = eventHandlers[event.type];
    
    if (!handler) {
      // Si nous ne savons pas traiter ce type d'événement, on l'ignore poliment
      console.log(`⚠️ Aucun gestionnaire pour l'événement : ${event.type}, ignoré...`);
      return { action: 'skipped', reason: 'unsupported_event_type' };
    }
    
    // Appeler le bon gestionnaire
    return await handler();
  }

  /**
   * ============================================================================
   * GESTIONNAIRES D'ÉVÉNEMENTS SPÉCIALISÉS
   * ============================================================================
   * 
   * Chaque méthode ci-dessous sait traiter un type spécifique d'événement Stripe.
   * C'est comme avoir des spécialistes : un cardiologue pour le cœur,
   * un dentiste pour les dents, etc.
   */

  /**
   * Traite un paiement ponctuel réussi
   * 
   * Cet événement arrive quand un utilisateur paye pour la première fois
   * et que le paiement réussit. Nous devons alors activer son abonnement.
   * 
   * C'est comme quand quelqu'un paye son inscription au club de sport :
   * une fois le paiement confirmé, on lui donne accès aux installations.
   */
  async handlePaymentIntentSucceeded(event, transaction) {
    console.log('💳 Traitement d\'un paiement ponctuel réussi...');
    
    const paymentIntent = event.data.object;
    const metadata = paymentIntent.metadata || {};
    
    // Stripe nous dit quel abonnement Portall correspond à ce paiement
    // grâce aux métadonnées que nous avons ajoutées lors de la création du paiement
    const subscriptionId = metadata.portall_subscription_id;
    
    if (!subscriptionId) {
      console.log('⚠️ Aucun ID d\'abonnement Portall dans les métadonnées, ignoré...');
      return { action: 'skipped', reason: 'no_portall_subscription_id' };
    }
    
    // ✅ VOICI OÙ LES ASSOCIATIONS SONT CRUCIALES !
    // Nous récupérons l'abonnement ET son plan en une seule requête
    // Avant la correction, cette ligne échouait avec "not associated"
    const subscription = await UserSubscription.findByPk(subscriptionId, {
      include: [{
        model: SubscriptionPlan,
        as: 'plan'  // Cette relation fonctionne maintenant grâce aux associations !
      }],
      transaction
    });
    
    if (!subscription) {
      throw new Error(`Abonnement ${subscriptionId} introuvable`);
    }
    
    console.log(`📋 Abonnement trouvé : ${subscription.plan?.name || 'Plan inconnu'}`);
    
    // Activer l'abonnement maintenant que le paiement est confirmé
    await subscription.update({
      status: 'active',
      started_at: new Date()
    }, { transaction });
    
    // Enregistrer ce paiement dans notre historique pour les rapports
    await PaymentHistory.create({
      subscription_id: subscription.id,
      stripe_payment_intent_id: paymentIntent.id,
      amount_in_cents: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'succeeded',
      payment_method: paymentIntent.payment_method_types?.[0] || 'unknown',
      processed_at: new Date()
    }, { transaction });
    
    console.log(`✅ Abonnement ${subscription.id} activé avec succès`);
    
    return {
      action: 'subscription_activated',
      subscription_id: subscription.id,
      plan_name: subscription.plan?.name || 'Plan inconnu',
      amount: paymentIntent.amount / 100 // Convertir les centimes en euros/dollars
    };
  }

  /**
   * Traite un paiement récurrent réussi
   * 
   * Cet événement arrive chaque mois/année quand Stripe prélève automatiquement
   * le paiement de l'abonnement. Nous devons prolonger la période d'accès.
   * 
   * C'est comme le renouvellement automatique d'un abonnement magazine :
   * chaque mois, le paiement est prélevé et votre abonnement est prolongé.
   */
  async handleInvoicePaymentSucceeded(event, transaction) {
    console.log('🔄 Traitement d\'un paiement récurrent réussi...');
    
    const invoice = event.data.object;
    const stripeSubscriptionId = invoice.subscription;
    
    if (!stripeSubscriptionId) {
      console.log('⚠️ Aucun ID d\'abonnement dans la facture, ignoré...');
      return { action: 'skipped', reason: 'no_subscription_id' };
    }
    
    // Trouver l'abonnement Portall qui correspond à cet abonnement Stripe
    const subscription = await UserSubscription.findOne({
      where: { stripe_subscription_id: stripeSubscriptionId },
      include: [{
        model: SubscriptionPlan,
        as: 'plan'
      }],
      transaction
    });
    
    if (!subscription) {
      console.log(`⚠️ Abonnement avec ID Stripe ${stripeSubscriptionId} introuvable`);
      return { action: 'skipped', reason: 'subscription_not_found' };
    }
    
    // Calculer la nouvelle date de fin selon le type d'abonnement
    const currentEndsAt = subscription.ends_at || new Date();
    const newEndsAt = new Date(currentEndsAt);
    
    // Ajouter la bonne période selon le plan
    if (subscription.plan?.billing_interval === 'month') {
      newEndsAt.setMonth(newEndsAt.getMonth() + 1);
    } else if (subscription.plan?.billing_interval === 'year') {
      newEndsAt.setFullYear(newEndsAt.getFullYear() + 1);
    } else if (subscription.plan?.billing_interval === 'week') {
      // Pour les plans de test
      newEndsAt.setDate(newEndsAt.getDate() + 7);
    }
    
    // Mettre à jour l'abonnement avec la nouvelle date de fin
    await subscription.update({
      status: 'active',
      ends_at: newEndsAt
    }, { transaction });
    
    // Enregistrer ce paiement récurrent dans l'historique
    await PaymentHistory.create({
      subscription_id: subscription.id,
      stripe_invoice_id: invoice.id,
      amount_in_cents: invoice.amount_paid,
      currency: invoice.currency,
      status: 'succeeded',
      payment_method: 'recurring',
      processed_at: new Date()
    }, { transaction });
    
    console.log(`✅ Abonnement ${subscription.id} renouvelé jusqu'au ${newEndsAt.toISOString().split('T')[0]}`);
    
    return {
      action: 'subscription_renewed',
      subscription_id: subscription.id,
      new_ends_at: newEndsAt,
      amount: invoice.amount_paid / 100
    };
  }

  /**
   * Traite un échec de paiement ponctuel
   * 
   * Quand un paiement initial échoue (carte refusée, fonds insuffisants, etc.),
   * nous devons marquer l'abonnement comme suspendu.
   */
  async handlePaymentIntentFailed(event, transaction) {
    console.log('❌ Traitement d\'un échec de paiement ponctuel...');
    
    const paymentIntent = event.data.object;
    const metadata = paymentIntent.metadata || {};
    const subscriptionId = metadata.portall_subscription_id;
    
    if (!subscriptionId) {
      return { action: 'skipped', reason: 'no_portall_subscription_id' };
    }
    
    const subscription = await UserSubscription.findByPk(subscriptionId, { transaction });
    
    if (!subscription) {
      return { action: 'skipped', reason: 'subscription_not_found' };
    }
    
    // Suspendre l'abonnement à cause de l'échec de paiement
    await subscription.update({
      status: 'suspended'
    }, { transaction });
    
    // Enregistrer l'échec dans l'historique pour le support client
    await PaymentHistory.create({
      subscription_id: subscription.id,
      stripe_payment_intent_id: paymentIntent.id,
      amount_in_cents: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'failed',
      payment_method: paymentIntent.payment_method_types?.[0] || 'unknown',
      failure_reason: paymentIntent.last_payment_error?.message || 'Paiement échoué',
      processed_at: new Date()
    }, { transaction });
    
    console.log(`⚠️ Abonnement ${subscription.id} suspendu à cause d'un échec de paiement`);
    
    return {
      action: 'subscription_suspended',
      subscription_id: subscription.id,
      reason: paymentIntent.last_payment_error?.message || 'Paiement échoué'
    };
  }

  /**
   * Traite un échec de paiement récurrent
   * 
   * Quand un paiement mensuel/annuel automatique échoue.
   */
  async handleInvoicePaymentFailed(event, transaction) {
    console.log('❌ Traitement d\'un échec de paiement récurrent...');
    
    const invoice = event.data.object;
    const stripeSubscriptionId = invoice.subscription;
    
    if (!stripeSubscriptionId) {
      return { action: 'skipped', reason: 'no_subscription_id' };
    }
    
    const subscription = await UserSubscription.findOne({
      where: { stripe_subscription_id: stripeSubscriptionId },
      transaction
    });
    
    if (!subscription) {
      return { action: 'skipped', reason: 'subscription_not_found' };
    }
    
    // Suspendre l'abonnement
    await subscription.update({
      status: 'suspended'
    }, { transaction });
    
    // Enregistrer l'échec
    await PaymentHistory.create({
      subscription_id: subscription.id,
      stripe_invoice_id: invoice.id,
      amount_in_cents: invoice.amount_due,
      currency: invoice.currency,
      status: 'failed',
      payment_method: 'recurring',
      failure_reason: 'Échec du paiement récurrent',
      processed_at: new Date()
    }, { transaction });
    
    return {
      action: 'subscription_suspended',
      subscription_id: subscription.id,
      reason: 'Échec du paiement récurrent'
    };
  }

  /**
   * ============================================================================
   * GESTIONNAIRES D'ABONNEMENT STRIPE
   * ============================================================================
   * 
   * Ces méthodes traitent les événements liés aux abonnements côté Stripe.
   * En général, nous gérons les abonnements côté Portall, donc ces événements
   * servent surtout à maintenir la synchronisation.
   */

  /**
   * Un nouvel abonnement a été créé côté Stripe
   */
  async handleSubscriptionCreated(event, transaction) {
    console.log('➕ Traitement de la création d\'abonnement Stripe...');
    
    const stripeSubscription = event.data.object;
    
    // Pour l'instant, on se contente de logger car nous gérons les abonnements côté Portall
    console.log(`📝 Nouvel abonnement Stripe créé : ${stripeSubscription.id}`);
    
    return {
      action: 'subscription_created_logged',
      stripe_subscription_id: stripeSubscription.id
    };
  }

  /**
   * Un abonnement Stripe a été modifié
   */
  async handleSubscriptionUpdated(event, transaction) {
    console.log('🔄 Traitement de la mise à jour d\'abonnement Stripe...');
    
    const stripeSubscription = event.data.object;
    
    // Chercher l'abonnement Portall correspondant
    const subscription = await UserSubscription.findOne({
      where: { stripe_subscription_id: stripeSubscription.id },
      transaction
    });
    
    if (!subscription) {
      return { action: 'skipped', reason: 'subscription_not_found' };
    }
    
    // Synchroniser le statut avec Stripe
    let newStatus = subscription.status;
    
    if (stripeSubscription.status === 'active') {
      newStatus = 'active';
    } else if (stripeSubscription.status === 'canceled') {
      newStatus = 'cancelled';
    } else if (stripeSubscription.status === 'past_due') {
      newStatus = 'suspended';
    }
    
    if (newStatus !== subscription.status) {
      await subscription.update({ status: newStatus }, { transaction });
      console.log(`✅ Statut de l'abonnement ${subscription.id} mis à jour : ${newStatus}`);
    }
    
    return {
      action: 'subscription_status_updated',
      subscription_id: subscription.id,
      old_status: subscription.status,
      new_status: newStatus
    };
  }

  /**
   * Un abonnement Stripe a été supprimé
   */
  async handleSubscriptionDeleted(event, transaction) {
    console.log('🗑️ Traitement de la suppression d\'abonnement Stripe...');
    
    const stripeSubscription = event.data.object;
    
    const subscription = await UserSubscription.findOne({
      where: { stripe_subscription_id: stripeSubscription.id },
      transaction
    });
    
    if (!subscription) {
      return { action: 'skipped', reason: 'subscription_not_found' };
    }
    
    // Marquer comme annulé (on garde les données pour l'historique)
    await subscription.update({
      status: 'cancelled',
      cancelled_at: new Date()
    }, { transaction });
    
    console.log(`✅ Abonnement ${subscription.id} marqué comme annulé`);
    
    return {
      action: 'subscription_cancelled',
      subscription_id: subscription.id
    };
  }
}

// ============================================================================
// EXPORT DU SERVICE
// ============================================================================

// Nous créons une seule instance du service que toute l'application va utiliser
// C'est ce qu'on appelle le pattern Singleton : une seule instance partagée
const webhookService = new WebhookService();

// Nous exportons cette instance unique
module.exports = webhookService;