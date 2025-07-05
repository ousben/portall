// portall/server/controllers/webhookController.js

/**
 * Contrôleur webhook Stripe pour Portall
 * 
 * Ce contrôleur est le "réceptionniste sécurisé" de votre système de paiement.
 * Il reçoit les webhooks Stripe, vérifie leur authenticité, et les dirige
 * vers le service approprié pour traitement.
 * 
 * Responsabilités du contrôleur webhook :
 * 
 * 1. SÉCURITÉ : Validation de la signature Stripe pour authentifier
 *    que les webhooks proviennent réellement de Stripe
 * 
 * 2. PARSING : Gestion du payload brut (raw) nécessaire pour la validation
 *    de signature (contrairement aux autres routes qui reçoivent du JSON)
 * 
 * 3. PERFORMANCE : Réponse rapide (< 30s) pour éviter les timeouts Stripe
 *    et les tentatives de retry excessives
 * 
 * 4. OBSERVABILITÉ : Logging détaillé pour faciliter le débogage
 *    et la conformité audit
 * 
 * 5. RESILIENCE : Gestion gracieuse des erreurs avec codes de retour
 *    appropriés pour indiquer à Stripe s'il doit retry ou non
 * 
 * Architecture des webhooks dans Express :
 * 
 * Stripe → Express Raw Middleware → WebhookController → WebhookService → Database
 *                     ↓
 *                Signature Validation
 *                     ↓
 *                Event Processing
 *                     ↓
 *                Business Logic
 */

const webhookService = require('../services/webhookService');

/**
 * Classe WebhookController
 * 
 * Cette classe encapsule toute la logique de réception et de validation
 * des webhooks Stripe. Elle suit le même pattern que vos autres contrôleurs
 * pour maintenir la cohérence architecturale.
 */
class WebhookController {
  constructor() {
    console.log('🎣 WebhookController initialized for Stripe events');
  }

  /**
   * Endpoint principal pour recevoir les webhooks Stripe
   * 
   * Cette méthode est le point d'entrée pour tous les webhooks Stripe.
   * Elle coordonne la validation, le traitement, et la réponse.
   * 
   * Route: POST /api/webhooks/stripe
   * Content-Type: application/json (mais payload en raw buffer)
   * 
   * @param {Express.Request} req - Requête Express avec payload brut
   * @param {Express.Response} res - Réponse Express
   */
  async handleStripeWebhook(req, res) {
    const startTime = Date.now();
    let eventType = 'unknown';
    let eventId = 'unknown';

    try {
      console.log('🎣 Incoming Stripe webhook request');
      
      // ================================
      // ÉTAPE 1: VALIDATION DU PAYLOAD BRUT
      // ================================
      
      // Récupérer le payload brut (nécessaire pour la validation de signature)
      // Express doit être configuré pour préserver le buffer original
      const payload = req.body;
      const signature = req.get('stripe-signature');
      
      if (!payload) {
        console.error('❌ Empty webhook payload received');
        return res.status(400).json({
          status: 'error',
          message: 'Empty payload',
          code: 'EMPTY_PAYLOAD'
        });
      }
      
      if (!signature) {
        console.error('❌ Missing Stripe signature header');
        return res.status(400).json({
          status: 'error',
          message: 'Missing Stripe signature',
          code: 'MISSING_SIGNATURE'
        });
      }
      
      console.log(`📦 Received payload: ${payload.length} bytes`);
      console.log(`🔏 Signature header: ${signature.substring(0, 20)}...`);
      
      // ================================
      // ÉTAPE 2: DÉLÉGATION AU SERVICE WEBHOOK
      // ================================
      
      // Le service webhook se charge de la validation de signature
      // et du traitement métier. Cette séparation des responsabilités
      // rend le code plus maintenable et testable.
      const result = await webhookService.processWebhook(payload, signature);
      
      // Extraire les informations pour le logging
      eventType = result.eventType || 'processed';
      eventId = result.eventId || 'unknown';
      
      // ================================
      // ÉTAPE 3: CONSTRUCTION DE LA RÉPONSE
      // ================================
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Webhook processed successfully in ${processingTime}ms`);
      
      // Réponse optimisée pour Stripe
      // Le format de réponse indique à Stripe que le webhook a été traité
      const response = {
        received: true,
        timestamp: new Date().toISOString(),
        eventId: eventId,
        processingTime: processingTime,
        status: 'success'
      };
      
      // Ajouter des détails supplémentaires en mode développement
      if (process.env.NODE_ENV === 'development') {
        response.debug = {
          eventType: eventType,
          payloadSize: payload.length,
          result: result
        };
      }
      
      // Stripe considère tout code 2xx comme un succès
      res.status(200).json(response);
      
    } catch (error) {
      // ================================
      // GESTION D'ERREUR STRATÉGIQUE
      // ================================
      
      const processingTime = Date.now() - startTime;
      console.error(`❌ Webhook processing failed after ${processingTime}ms:`, error.message);
      
      // Logging détaillé pour le débogage
      console.error('Error details:', {
        eventType: eventType,
        eventId: eventId,
        errorMessage: error.message,
        errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        processingTime: processingTime
      });
      
      // ================================
      // STRATÉGIE DE CODES D'ERREUR POUR STRIPE
      // ================================
      
      let statusCode = 500;
      let shouldRetry = true;
      
      // Analyser le type d'erreur pour déterminer la réponse appropriée
      if (error.message.includes('Invalid webhook signature')) {
        // Erreur de signature : ne pas retry (problème de configuration)
        statusCode = 401;
        shouldRetry = false;
        console.error('🔐 Signature validation failed - check STRIPE_WEBHOOK_SECRET');
      } else if (error.message.includes('Event already processed')) {
        // Idempotence : traiter comme un succès
        statusCode = 200;
        shouldRetry = false;
        console.log('♻️ Duplicate event detected - responding with success');
      } else if (error.message.includes('Subscription not found')) {
        // Données métier incohérentes : retry pourrait aider
        statusCode = 404;
        shouldRetry = true;
        console.error('🔍 Data inconsistency detected - Stripe may retry');
      } else {
        // Erreur système générale : retry recommandé
        statusCode = 500;
        shouldRetry = true;
        console.error('💥 System error - Stripe will retry automatically');
      }
      
      // Construction de la réponse d'erreur
      const errorResponse = {
        received: false,
        timestamp: new Date().toISOString(),
        eventId: eventId,
        processingTime: processingTime,
        status: 'error',
        error: {
          message: error.message,
          code: error.code || 'WEBHOOK_PROCESSING_ERROR',
          shouldRetry: shouldRetry
        }
      };
      
      // Informations supplémentaires en développement
      if (process.env.NODE_ENV === 'development') {
        errorResponse.debug = {
          eventType: eventType,
          originalError: error.originalError?.message,
          stack: error.stack
        };
      }
      
      res.status(statusCode).json(errorResponse);
    }
  }

  /**
   * Endpoint de santé pour vérifier que le service webhook fonctionne
   * 
   * Cette route permet de tester que votre endpoint webhook est accessible
   * et que la configuration de base est correcte.
   * 
   * Route: GET /api/webhooks/health
   */
  async healthCheck(req, res) {
    try {
      console.log('🏥 Webhook health check requested');
      
      // Vérifications de base
      const checks = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
        stripeConnection: false,
        database: false
      };
      
      // Test de connexion Stripe (optionnel pour la santé)
      try {
        const { stripe } = require('../config/stripe');
        await stripe.accounts.retrieve();
        checks.stripeConnection = true;
      } catch (error) {
        console.warn('⚠️ Stripe connection test failed:', error.message);
      }
      
      // Test de connexion base de données
      try {
        const { sequelize } = require('../config/database.connection');
        await sequelize.authenticate();
        checks.database = true;
      } catch (error) {
        console.warn('⚠️ Database connection test failed:', error.message);
      }
      
      // Déterminer le statut global
      const isHealthy = checks.webhookSecret && checks.database;
      const statusCode = isHealthy ? 200 : 503;
      
      const response = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 
          'Webhook service is operational' : 
          'Webhook service has configuration issues',
        checks: checks,
        recommendations: []
      };
      
      // Ajouter des recommandations si nécessaire
      if (!checks.webhookSecret) {
        response.recommendations.push('Configure STRIPE_WEBHOOK_SECRET environment variable');
      }
      
      if (!checks.stripeConnection) {
        response.recommendations.push('Check Stripe API key configuration');
      }
      
      if (!checks.database) {
        response.recommendations.push('Verify database connection and migrations');
      }
      
      console.log(`🏥 Health check result: ${response.status}`);
      res.status(statusCode).json(response);
      
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      
      res.status(500).json({
        status: 'error',
        message: 'Health check system failure',
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
      });
    }
  }

  /**
   * Endpoint pour lister les types d'événements supportés
   * 
   * Cette route utilitaire aide au débogage et à la documentation
   * en listant tous les événements Stripe que votre système peut traiter.
   * 
   * Route: GET /api/webhooks/events
   */
  async listSupportedEvents(req, res) {
    try {
      console.log('📋 Supported events list requested');
      
      // Récupérer la liste des événements supportés depuis le service
      const supportedEvents = Object.keys(webhookService.eventProcessors);
      
      const response = {
        status: 'success',
        message: 'Supported Stripe events',
        timestamp: new Date().toISOString(),
        supportedEvents: supportedEvents.map(eventType => ({
          type: eventType,
          description: this.getEventDescription(eventType),
          category: this.getEventCategory(eventType)
        })),
        totalSupported: supportedEvents.length,
        documentation: {
          stripeReference: 'https://stripe.com/docs/webhooks/webhook-events',
          implementation: 'See WebhookService.eventProcessors for handlers'
        }
      };
      
      res.json(response);
      
    } catch (error) {
      console.error('❌ Failed to list supported events:', error.message);
      
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve supported events',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
      });
    }
  }

  /**
   * Méthode utilitaire pour obtenir la description d'un événement
   */
  getEventDescription(eventType) {
    const descriptions = {
      'payment_intent.succeeded': 'Paiement ponctuel réussi (premier paiement d\'abonnement)',
      'payment_intent.payment_failed': 'Échec de paiement ponctuel',
      'invoice.payment_succeeded': 'Paiement récurrent d\'abonnement réussi',
      'invoice.payment_failed': 'Échec de paiement récurrent d\'abonnement',
      'customer.subscription.created': 'Nouvel abonnement créé chez Stripe',
      'customer.subscription.updated': 'Abonnement modifié (changement de statut, plan, etc.)',
      'customer.subscription.deleted': 'Abonnement annulé définitivement',
      'customer.created': 'Nouveau client créé chez Stripe',
      'customer.updated': 'Informations client mises à jour',
      'customer.deleted': 'Client supprimé chez Stripe'
    };
    
    return descriptions[eventType] || 'Événement Stripe géré par Portall';
  }

  /**
   * Méthode utilitaire pour catégoriser les événements
   */
  getEventCategory(eventType) {
    if (eventType.startsWith('payment_intent.')) return 'Payment';
    if (eventType.startsWith('invoice.')) return 'Billing';
    if (eventType.startsWith('customer.subscription.')) return 'Subscription';
    if (eventType.startsWith('customer.')) return 'Customer';
    return 'Other';
  }

  /**
   * Méthode utilitaire pour obtenir des statistiques sur les webhooks
   * 
   * Cette méthode pourrait être étendue pour fournir des métriques
   * de performance et de fiabilité de votre système webhook.
   * 
   * Route: GET /api/webhooks/stats
   */
  async getWebhookStats(req, res) {
    try {
      console.log('📊 Webhook statistics requested');
      
      // Dans une implémentation complète, vous récupéreriez ces statistiques
      // depuis votre base de données ou un système de monitoring
      const stats = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        service: {
          status: 'operational',
          version: '1.0.0',
          supportedEvents: Object.keys(webhookService.eventProcessors).length
        },
        // Statistiques simulées - à remplacer par de vraies métriques
        metrics: {
          totalWebhooksReceived: 'Not implemented',
          successRate: 'Not implemented',
          averageProcessingTime: 'Not implemented',
          lastProcessedEvent: 'Not implemented'
        },
        recommendations: [
          'Consider implementing Redis for webhook idempotency',
          'Add monitoring with tools like Datadog or New Relic',
          'Set up alerting for webhook processing failures'
        ]
      };
      
      res.json(stats);
      
    } catch (error) {
      console.error('❌ Failed to retrieve webhook stats:', error.message);
      
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve webhook statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
      });
    }
  }
}

// Export d'une instance du contrôleur
// Cette approche maintient la cohérence avec vos autres contrôleurs
const webhookController = new WebhookController();

// Export des méthodes pour utilisation dans les routes
module.exports = {
  handleStripeWebhook: webhookController.handleStripeWebhook.bind(webhookController),
  healthCheck: webhookController.healthCheck.bind(webhookController),
  listSupportedEvents: webhookController.listSupportedEvents.bind(webhookController),
  getWebhookStats: webhookController.getWebhookStats.bind(webhookController)
};