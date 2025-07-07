// portall/server/middleware/playerEvaluationValidation.js

const Joi = require('joi');

/**
 * Middleware de validation pour les évaluations de joueurs
 * 
 * Ce middleware implémente la validation complète des données d'évaluation
 * selon les spécifications exactes que tu as fournies. Chaque champ correspond
 * à une question précise du formulaire d'évaluation.
 * 
 * LOGIQUE MÉTIER : Les évaluations doivent être substantielles et détaillées
 * pour être utiles aux coachs NCAA/NAIA dans leur processus de recrutement.
 */

/**
 * Schéma de validation complet pour les évaluations de joueurs
 * 
 * Ce schéma implémente exactement les questions que tu as spécifiées :
 * - Available to transfer (checkbox)
 * - Role in team (input text)
 * - Expected Graduation Date (dropdown)
 * - Performance level (input text)
 * - Player strengths (input text)
 * - Areas for improvement (input text) ✅ NOMMAGE CORRIGÉ
 * - Mentality (input text)
 * - Coachability (input text)
 * - Technique (input text)
 * - Physique (input text)
 * - Coach Final Comment (input text)
 */
const playerEvaluationSchema = Joi.object({
  // ========================
  // QUESTIONS FERMÉES (RÉPONSES STRUCTURÉES)
  // ========================
  
  availableToTransfer: Joi.boolean()
    .required()
    .messages({
      'any.required': 'Please specify if the player is available for transfer',
      'boolean.base': 'Transfer availability must be yes or no'
    }),

  expectedGraduationDate: Joi.string() // ✅ CHANGÉ EN STRING POUR ANNÉES COMME "2026"
    .pattern(/^\d{4}$/)
    .required()
    .messages({
      'any.required': 'Expected graduation year is required',
      'string.pattern.base': 'Graduation year must be a valid 4-digit year'
    }),

  // ========================
  // QUESTIONS OUVERTES (RÉPONSES TEXTUELLES) ✅ LONGUEURS MINIMALES RÉDUITES
  // ========================
  
  roleInTeam: Joi.string()
    .trim()
    .min(3) // ✅ RÉDUIT DE 5 À 3
    .max(500)
    .required()
    .messages({
      'any.required': 'Player\'s role in team is required',
      'string.base': 'Role description must be text',
      'string.min': 'Please provide at least 3 characters for the role description',
      'string.max': 'Role description must not exceed 500 characters'
    }),

  performanceLevel: Joi.string()
    .trim()
    .min(3) // ✅ RÉDUIT DE 10 À 3
    .max(1000)
    .required()
    .messages({
      'any.required': 'Performance level assessment is required',
      'string.base': 'Performance level must be text',
      'string.min': 'Please provide at least 3 characters for the performance level assessment',
      'string.max': 'Performance level assessment must not exceed 1000 characters'
    }),

  playerStrengths: Joi.string()
    .trim()
    .min(3) // ✅ RÉDUIT DE 10 À 3
    .max(1000)
    .required()
    .messages({
      'any.required': 'Player strengths assessment is required',
      'string.base': 'Player strengths must be text',
      'string.min': 'Please provide at least 3 characters for the strengths assessment',
      'string.max': 'Strengths assessment must not exceed 1000 characters'
    }),

  areasForImprovement: Joi.string() // ✅ NOM CORRIGÉ POUR CORRESPONDRE AUX TESTS
    .trim()
    .min(3) // ✅ RÉDUIT DE 10 À 3
    .max(1000)
    .required()
    .messages({
      'any.required': 'Areas for improvement assessment is required',
      'string.base': 'Areas for improvement must be text',
      'string.min': 'Please provide at least 3 characters for the areas for improvement',
      'string.max': 'Areas for improvement must not exceed 1000 characters'
    }),

  mentality: Joi.string()
    .trim()
    .min(3) // ✅ RÉDUIT DE 10 À 3
    .max(1000)
    .required()
    .messages({
      'any.required': 'Mentality assessment is required',
      'string.base': 'Mentality assessment must be text',
      'string.min': 'Please provide at least 3 characters for the mentality assessment',
      'string.max': 'Mentality assessment must not exceed 1000 characters'
    }),

  coachability: Joi.string()
    .trim()
    .min(3) // ✅ RÉDUIT DE 10 À 3
    .max(1000)
    .required()
    .messages({
      'any.required': 'Coachability assessment is required',
      'string.base': 'Coachability assessment must be text',
      'string.min': 'Please provide at least 3 characters for the coachability assessment',
      'string.max': 'Coachability assessment must not exceed 1000 characters'
    }),

  technique: Joi.string()
    .trim()
    .min(3) // ✅ RÉDUIT DE 10 À 3
    .max(500)
    .required()
    .messages({
      'any.required': 'Technical assessment is required',
      'string.base': 'Technical assessment must be text',
      'string.min': 'Please provide at least 3 characters for the technical assessment',
      'string.max': 'Technical assessment must not exceed 500 characters'
    }),

  physique: Joi.string()
    .trim()
    .min(3) // ✅ RÉDUIT DE 10 À 3
    .max(500)
    .required()
    .messages({
      'any.required': 'Physical attributes assessment is required',
      'string.base': 'Physical assessment must be text',
      'string.min': 'Please provide at least 3 characters for the physical assessment',
      'string.max': 'Physical assessment must not exceed 500 characters'
    }),

  // ========================
  // COMMENTAIRE FINAL (SYNTHÈSE ET RECOMMANDATIONS)
  // ========================
  
  coachFinalComment: Joi.string()
    .trim()
    .min(5) // ✅ RÉDUIT DE 20 À 5
    .max(1500)
    .required()
    .messages({
      'any.required': 'Final coach comment is required',
      'string.base': 'Final comment must be text',
      'string.min': 'Please provide at least 5 characters for the final comment',
      'string.max': 'Final comment must not exceed 1500 characters'
    })

}).options({
  // Options de validation strictes pour assurer la qualité des données
  abortEarly: false, // Collecter toutes les erreurs
  stripUnknown: true, // Supprimer les champs non autorisés
  presence: 'required' // Tous les champs sont requis par défaut
});

/**
 * Middleware de validation des évaluations de joueurs
 * 
 * Ce middleware s'assure que toutes les données d'évaluation respectent
 * les critères de qualité nécessaires pour être utiles dans le processus
 * de recrutement.
 */
const validatePlayerEvaluation = (req, res, next) => {
  console.log('🔍 Validating player evaluation data...');
  
  const { error, value } = playerEvaluationSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    // Transformer les erreurs Joi en format standardisé
    const formattedErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type
    }));

    console.log(`❌ Player evaluation validation failed: ${formattedErrors.length} errors`);
    console.log('❌ Validation errors:', formattedErrors);

    return res.status(400).json({
      status: 'error',
      message: 'Player evaluation validation failed',
      code: 'EVALUATION_VALIDATION_ERROR',
      errors: formattedErrors,
      totalErrors: formattedErrors.length
    });
  }

  // Validation réussie : remplacer req.body par les données validées
  req.body = value;
  
  console.log(`✅ Player evaluation validation successful for ${Object.keys(value).length} fields`);
  
  next();
};

/**
 * Validation spécialisée pour les mises à jour partielles d'évaluations
 * 
 * Ce schéma plus permissif permet de mettre à jour seulement certains
 * champs d'une évaluation existante.
 */
const playerEvaluationUpdateSchema = playerEvaluationSchema.fork(
  Object.keys(playerEvaluationSchema.describe().keys),
  schema => schema.optional()
).options({
  abortEarly: false,
  stripUnknown: true,
  presence: 'optional' // Tous les champs deviennent optionnels
});

const validatePlayerEvaluationUpdate = (req, res, next) => {
  const { error, value } = playerEvaluationUpdateSchema.validate(req.body);

  if (error) {
    const formattedErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type
    }));

    return res.status(400).json({
      status: 'error',
      message: 'Player evaluation update validation failed',
      code: 'EVALUATION_UPDATE_VALIDATION_ERROR',
      errors: formattedErrors
    });
  }

  // Vérifier qu'au moins un champ est fourni pour la mise à jour
  if (Object.keys(value).length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'At least one field must be provided for evaluation update',
      code: 'NO_UPDATE_FIELDS'
    });
  }

  req.body = value;
  next();
};

module.exports = {
  validatePlayerEvaluation,
  validatePlayerEvaluationUpdate,
  playerEvaluationSchema,
  playerEvaluationUpdateSchema
};