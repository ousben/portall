// portall/server/routes/webhooks.js

/**
 * Routes webhook Stripe pour Portall
 * 
 * Ce fichier configure les routes spécialisées pour recevoir les webhooks Stripe.
 * Ces routes ont des exigences techniques particulières qui diffèrent de vos
 * routes API classiques.
 * 
 * Défis techniques des routes webhook :
 * 
 * 1. PAYLOAD BRUT : Stripe nécessite le contenu original non parsé pour
 *    valider la signature cryptographique. Express doit préserver le buffer.
 * 
 * 2. SÉCURITÉ DIFFÉRENTE : Pas d'authentification JWT, mais validation
 *    de signature HMAC-SHA256 fournie par Stripe.
 * 
 * 3. PERFORMANCE CRITIQUE : Réponse sous 30 secondes obligatoire pour
 *    éviter les timeouts et les retry excessifs de Stripe.
 * 
 * 4. IDEMPOTENCE : Stripe peut envoyer le même webhook plusieurs fois.
 *    Notre système doit gérer cela gracieusement.
 * 
 * 5. MONITORING : Logs détaillés nécessaires pour auditer les paiements
 *    et résoudre les problèmes client.
 * 
 * Architecture de middleware spécialisé :
 * 
 * Express Router → Raw Body Middleware → Webhook Controller → Webhook Service
 *                         ↓
 *                   Buffer Preservation
 *                         ↓
 *                 Signature Validation
 *                         ↓
 *                   Business Logic
 */

const express = require('express');
const router = express.Router();

// Import du contrôleur webhook que nous venons de créer
const webhookController = require('../controllers/webhookController');

// Import pour la configuration de logging spécialisé
const rateLimit = require('express-rate-limit');

/**
 * Configuration du rate limiting spécialisé pour les webhooks
 * 
 * Les webhooks ont des besoins de rate limiting différents de vos API utilisateur.
 * Stripe envoie les webhooks selon ses propres règles, nous devons donc être
 * plus permissifs tout en nous protégeant contre les abus potentiels.
 */
const webhookRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // Fenêtre de 15 minutes
  max: 1000, // 1000 webhooks par fenêtre (très permissif pour Stripe)
  message: {
    status: 'error',
    message: 'Trop de webhooks reçus, veuillez contacter le support',
    code: 'WEBHOOK_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Identifier par IP uniquement (pas d'utilisateur pour les webhooks)
  keyGenerator: (req) => req.ip,
  // Ne pas compter les webhooks réussis (seuls les échecs consomment la limite)
  skipSuccessfulRequests: true
});

/**
 * Middleware critique : Préservation du payload brut
 * 
 * Ce middleware est la clé technique de notre système webhook. Il contourne
 * le parsing JSON automatique d'Express pour préserver le contenu original
 * nécessaire à la validation de signature Stripe.
 * 
 * Fonctionnement technique :
 * 1. Express lit le stream de données entrantes
 * 2. Au lieu de parser en JSON, on stocke le buffer brut
 * 3. On préserve ce buffer dans req.body pour le contrôleur
 * 4. La signature Stripe peut alors être validée correctement
 */
const rawBodyMiddleware = (req, res, next) => {
  // Vérifier que c'est bien un webhook Stripe
  const contentType = req.get('Content-Type');
  
  if (!contentType || !contentType.startsWith('application/json')) {
    console.warn(`⚠️ Unexpected content-type for webhook: ${contentType}`);
    return res.status(400).json({
      status: 'error',
      message: 'Invalid content-type for webhook',
      expected: 'application/json',
      received: contentType
    });
  }
  
  // Collecter les chunks de données brutes
  let rawData = Buffer.alloc(0);
  
  req.on('data', (chunk) => {
    rawData = Buffer.concat([rawData, chunk]);
    
    // Protection contre les payloads excessivement volumineux
    // Stripe envoie généralement des webhooks < 100KB
    if (rawData.length > 1024 * 1024) { // 1MB limite
      console.error('❌ Webhook payload too large:', rawData.length);
      return res.status(413).json({
        status: 'error',
        message: 'Webhook payload too large',
        maxSize: '1MB'
      });
    }
  });
  
  req.on('end', () => {
    try {
      // Stocker le buffer brut pour la validation de signature
      req.body = rawData;
      
      console.log(`📦 Raw webhook payload preserved: ${rawData.length} bytes`);
      next();
      
    } catch (error) {
      console.error('❌ Failed to process raw webhook data:', error.message);
      res.status(400).json({
        status: 'error',
        message: 'Failed to process webhook payload',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Invalid payload'
      });
    }
  });
  
  req.on('error', (error) => {
    console.error('❌ Error reading webhook stream:', error.message);
    res.status(400).json({
      status: 'error',
      message: 'Error reading webhook data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Stream error'
    });
  });
};

/**
 * Middleware de logging spécialisé pour les webhooks
 * 
 * Ce middleware capture des informations cruciales pour l'audit financier
 * et le débogage des problèmes de paiement. Chaque webhook est tracé
 * avec suffisamment de détails pour reconstituer les événements.
 */
const webhookLoggingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const requestId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Enrichir la requête avec un identifiant unique
  req.webhookRequestId = requestId;
  
  console.log('🎣 Incoming webhook request:', {
    requestId: requestId,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    stripeSignature: req.get('stripe-signature') ? 'present' : 'missing'
  });
  
  // Intercepter la réponse pour logger le résultat
  const originalSend = res.send;
  res.send = function(body) {
    const processingTime = Date.now() - startTime;
    
    console.log('📤 Webhook response:', {
      requestId: requestId,
      statusCode: res.statusCode,
      processingTime: processingTime,
      success: res.statusCode >= 200 && res.statusCode < 300
    });
    
    // Si c'est un échec, logger plus de détails
    if (res.statusCode >= 400) {
      console.error('❌ Webhook processing failed:', {
        requestId: requestId,
        statusCode: res.statusCode,
        responseBody: typeof body === 'string' ? JSON.parse(body) : body
      });
    }
    
    originalSend.call(this, body);
  };
  
  next();
};

/**
 * Route principale : POST /api/webhooks/stripe
 * 
 * Cette route est l'endpoint que vous configurerez dans votre Dashboard Stripe.
 * Elle reçoit tous les événements Stripe et les dirige vers le contrôleur
 * approprié pour traitement.
 * 
 * Configuration Stripe Dashboard :
 * URL: https://votre-domaine.com/api/webhooks/stripe
 * Méthode: POST
 * Événements: Sélectionnés selon vos besoins (voir WEBHOOK_EVENTS)
 */
router.post('/stripe',
  webhookRateLimit,           // Protection contre les abus
  webhookLoggingMiddleware,   // Audit et débogage
  rawBodyMiddleware,          // Préservation du payload brut
  webhookController.handleStripeWebhook  // Traitement métier
);

/**
 * Route de santé : GET /api/webhooks/health
 * 
 * Cette route permet de vérifier que votre endpoint webhook est accessible
 * et correctement configuré. Utile pour les tests et le monitoring.
 */
router.get('/health', 
  webhookController.healthCheck
);

/**
 * Route d'information : GET /api/webhooks/events
 * 
 * Cette route utilitaire liste tous les types d'événements Stripe
 * que votre système peut traiter. Pratique pour la documentation
 * et le débogage.
 */
router.get('/events',
  webhookController.listSupportedEvents
);

/**
 * Route de statistiques : GET /api/webhooks/stats
 * 
 * Cette route fournit des métriques sur le fonctionnement de votre
 * système webhook. En production, vous pourriez l'étendre avec des
 * données temps réel depuis une base de monitoring.
 */
router.get('/stats',
  webhookController.getWebhookStats
);

/**
 * Route de test : POST /api/webhooks/test (développement uniquement)
 * 
 * Cette route permet de tester votre système webhook en simulant
 * des événements Stripe. Très utile pendant le développement pour
 * valider votre logique sans dépendre de vrais événements Stripe.
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test',
    express.json(), // Parser JSON normal pour les tests
    async (req, res) => {
      try {
        console.log('🧪 Test webhook requested');
        
        const { eventType, data } = req.body;
        
        if (!eventType || !data) {
          return res.status(400).json({
            status: 'error',
            message: 'Test webhook requires eventType and data',
            example: {
              eventType: 'payment_intent.succeeded',
              data: { object: { id: 'pi_test_123', metadata: { portall_subscription_id: '1' } } }
            }
          });
        }
        
        // Simuler un événement Stripe
        const mockEvent = {
          id: `evt_test_${Date.now()}`,
          type: eventType,
          created: Math.floor(Date.now() / 1000),
          data: data
        };
        
        // Traiter avec le service webhook (sans validation de signature)
        const webhookService = require('../services/webhookService');
        const result = await webhookService.processWebhook(
          JSON.stringify(mockEvent), 
          'test_signature'
        );
        
        res.json({
          status: 'success',
          message: 'Test webhook processed',
          mockEvent: mockEvent,
          result: result
        });
        
      } catch (error) {
        console.error('❌ Test webhook failed:', error.message);
        
        res.status(500).json({
          status: 'error',
          message: 'Test webhook processing failed',
          error: error.message
        });
      }
    }
  );
  
  console.log('🧪 Test webhook route enabled for development');
}

/**
 * Middleware de gestion d'erreur spécialisé pour les webhooks
 * 
 * Ce middleware capture toute erreur non gérée dans les routes webhook
 * et s'assure que Stripe reçoit une réponse appropriée pour déterminer
 * s'il doit retry l'événement ou non.
 */
router.use((error, req, res, next) => {
  console.error('💥 Unhandled webhook route error:', {
    requestId: req.webhookRequestId,
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method
  });
  
  // Réponse d'erreur générique pour Stripe
  res.status(500).json({
    status: 'error',
    message: 'Webhook route error',
    requestId: req.webhookRequestId,
    timestamp: new Date().toISOString(),
    // Indique à Stripe qu'il peut retry
    retryable: true
  });
});

/**
 * Documentation de l'endpoint principal (commentaire de référence)
 * 
 * Pour configurer ce webhook dans votre Dashboard Stripe :
 * 
 * 1. Connectez-vous à dashboard.stripe.com
 * 2. Allez dans "Developers" > "Webhooks"
 * 3. Cliquez "Add endpoint"
 * 4. URL : https://votre-domaine.com/api/webhooks/stripe
 * 5. Sélectionnez ces événements :
 *    - payment_intent.succeeded
 *    - payment_intent.payment_failed
 *    - invoice.payment_succeeded
 *    - invoice.payment_failed
 *    - customer.subscription.created
 *    - customer.subscription.updated
 *    - customer.subscription.deleted
 * 6. Copiez le "Signing secret" dans votre .env comme STRIPE_WEBHOOK_SECRET
 */

module.exports = router;