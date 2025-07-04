// portall/server/middleware/subscriptionValidation.js

/**
 * Middleware de validation pour les routes d'abonnement
 * 
 * Ce middleware applique une validation rigoureuse à toutes les données
 * liées aux paiements. La validation se fait en plusieurs couches :
 * 
 * 1. STRUCTURE : Format et types de données
 * 2. CONTENU : Valeurs autorisées et cohérence
 * 3. MÉTIER : Règles business spécifiques à Portall
 * 4. SÉCURITÉ : Prévention des attaques par injection
 * 
 * Chaque validation échouée retourne une erreur détaillée pour aider
 * le développeur frontend à corriger le problème.
 */

const Joi = require('joi');

/**
 * Schéma de validation pour la création d'abonnement
 * 
 * Ce schéma définit exactement quelles données sont attendues
 * et dans quel format pour créer un abonnement.
 */
const createSubscriptionSchema = Joi.object({
  // ID du plan choisi
  planId: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'L\'ID du plan doit être un nombre',
      'number.integer': 'L\'ID du plan doit être un entier',
      'number.positive': 'L\'ID du plan doit être positif',
      'any.required': 'L\'ID du plan est obligatoire'
    }),

  // ID de la méthode de paiement Stripe
  paymentMethodId: Joi.string()
    .pattern(/^pm_[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.base': 'L\'ID de méthode de paiement doit être une chaîne',
      'string.pattern.base': 'L\'ID de méthode de paiement doit avoir le format Stripe (pm_...)',
      'any.required': 'La méthode de paiement est obligatoire'
    }),

  // Métadonnées optionnelles
  metadata: Joi.object({
    source: Joi.string().valid('web', 'mobile', 'api').default('web'),
    campaign: Joi.string().max(100).optional(),
    referrer: Joi.string().uri().optional()
  }).optional(),

  // Confirmation explicite des conditions
  acceptTerms: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'Vous devez accepter les conditions d\'utilisation',
      'any.required': 'L\'acceptation des conditions est obligatoire'
    }),

  // Confirmation du prix (sécurité contre la manipulation)
  confirmedPrice: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.base': 'Le prix confirmé doit être un nombre',
      'number.positive': 'Le prix confirmé doit être positif',
      'any.required': 'La confirmation du prix est obligatoire'
    })
});

/**
 * Schéma de validation pour l'annulation d'abonnement
 * 
 * Plus simple, mais inclut la capture de la raison d'annulation
 * pour améliorer votre compréhension des churns utilisateurs.
 */
const cancelSubscriptionSchema = Joi.object({
  // Raison de l'annulation (optionnelle mais utile)
  reason: Joi.string()
    .valid(
      'too_expensive',
      'not_using_enough', 
      'found_alternative',
      'technical_issues',
      'poor_support',
      'missing_features',
      'other'
    )
    .optional()
    .messages({
      'any.only': 'Raison d\'annulation non valide'
    }),

  // Commentaire libre (optionnel)
  comment: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Le commentaire ne peut pas dépasser 500 caractères'
    }),

  // Confirmation explicite de l'annulation
  confirmCancellation: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'Vous devez confirmer l\'annulation',
      'any.required': 'La confirmation d\'annulation est obligatoire'
    })
});

/**
 * Middleware de validation pour la création d'abonnement
 * 
 * Cette fonction valide les données et effectue des vérifications
 * métier additionnelles.
 */
const validateCreateSubscription = async (req, res, next) => {
  try {
    console.log('🔍 Validating subscription creation data...');

    // Validation Joi standard
    const validationResult = await createSubscriptionSchema.validateAsync(req.body, {
      abortEarly: false, // Collecter toutes les erreurs
      stripUnknown: true // Supprimer les champs non définis
    });

    // Vérifications métier additionnelles
    const businessValidation = await validateBusinessRules(validationResult, req.user);
    
    if (!businessValidation.isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation métier échouée',
        errors: businessValidation.errors
      });
    }

    // Remplacer req.body par les données validées et nettoyées
    req.body = validationResult;
    
    console.log('✅ Subscription creation data validated successfully');
    next();

  } catch (error) {
    console.error('❌ Subscription validation failed:', error);

    // Formater les erreurs Joi pour le frontend
    if (error.isJoi) {
      const formattedErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        status: 'error',
        message: 'Données de souscription invalides',
        errors: formattedErrors
      });
    }

    // Erreur inattendue
    res.status(500).json({
      status: 'error',
      message: 'Erreur de validation interne',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware de validation pour l'annulation d'abonnement
 */
const validateCancelSubscription = async (req, res, next) => {
  try {
    console.log('🔍 Validating subscription cancellation data...');

    // Validation Joi (plus simple pour l'annulation)
    const validationResult = await cancelSubscriptionSchema.validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    req.body = validationResult;
    
    console.log('✅ Subscription cancellation data validated successfully');
    next();

  } catch (error) {
    console.error('❌ Cancellation validation failed:', error);

    if (error.isJoi) {
      const formattedErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        status: 'error',
        message: 'Données d\'annulation invalides',
        errors: formattedErrors
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Erreur de validation interne'
    });
  }
};

/**
 * Validation des règles métier spécifiques à Portall
 * 
 * Cette fonction effectue des vérifications qui nécessitent
 * l'accès à la base de données ou à la logique métier.
 */
async function validateBusinessRules(data, user) {
  const errors = [];

  try {
    // Vérifier que l'utilisateur peut souscrire (compte actif, email vérifié)
    if (!user.isActive) {
      errors.push({
        field: 'user',
        message: 'Votre compte doit être activé pour souscrire un abonnement',
        code: 'USER_INACTIVE'
      });
    }

    if (!user.isEmailVerified) {
      errors.push({
        field: 'user',
        message: 'Votre email doit être vérifié pour souscrire un abonnement',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Vérifier que le plan existe et est disponible pour ce type d'utilisateur
    const { sequelize } = require('../config/database.connection');
    const SubscriptionPlan = require('../models/SubscriptionPlan')(sequelize, sequelize.Sequelize.DataTypes);
    
    const plan = await SubscriptionPlan.findOne({
      where: {
        id: data.planId,
        is_active: true
      }
    });

    if (!plan) {
      errors.push({
        field: 'planId',
        message: 'Plan d\'abonnement non trouvé ou inactif',
        code: 'PLAN_NOT_FOUND'
      });
    } else {
      // Vérifier que le plan est disponible pour ce type d'utilisateur
      if (!plan.allowed_user_types.includes(user.userType)) {
        errors.push({
          field: 'planId',
          message: `Ce plan n'est pas disponible pour les utilisateurs de type ${user.userType}`,
          code: 'PLAN_NOT_ALLOWED_FOR_USER_TYPE'
        });
      }

      // Vérifier la cohérence du prix confirmé
      const expectedPrice = plan.price_in_cents / 100;
      if (Math.abs(data.confirmedPrice - expectedPrice) > 0.01) {
        errors.push({
          field: 'confirmedPrice',
          message: `Prix confirmé incorrect. Attendu: ${expectedPrice}, reçu: ${data.confirmedPrice}`,
          code: 'PRICE_MISMATCH'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };

  } catch (error) {
    console.error('❌ Business validation error:', error);
    return {
      isValid: false,
      errors: [{
        field: 'system',
        message: 'Erreur de validation métier',
        code: 'BUSINESS_VALIDATION_ERROR'
      }]
    };
  }
}

// Export des middleware de validation
module.exports = {
  validateSubscriptionData: {
    createSubscription: validateCreateSubscription,
    cancelSubscription: validateCancelSubscription
  },
  // Export des schémas pour les tests
  schemas: {
    createSubscriptionSchema,
    cancelSubscriptionSchema
  }
};