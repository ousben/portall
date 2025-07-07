// server/middleware/playerEvaluationValidation.js

const Joi = require('joi');

/**
 * 🎯 Middleware de validation pour les évaluations de joueurs par les coachs NJCAA
 * 
 * CONCEPT PÉDAGOGIQUE : Ce middleware illustre comment créer une validation métier
 * complexe avec des règles spécifiques au domaine du recrutement sportif.
 * 
 * 📊 SYSTÈME D'ÉVALUATION À 11 CRITÈRES :
 * Chaque critère est noté de 1 à 10, permettant une évaluation granulaire
 * des capacités du joueur selon les standards NJCAA.
 */

// ========================
// SCHÉMA DE VALIDATION PRINCIPAL
// ========================

const playerEvaluationSchema = Joi.object({
  // ========================
  // ÉVALUATIONS TECHNIQUES (1-10)
  // ========================
  
  speed: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
    .messages({
      'any.required': 'Speed assessment is required',
      'number.base': 'Speed must be a number',
      'number.integer': 'Speed must be a whole number',
      'number.min': 'Speed rating must be at least 1',
      'number.max': 'Speed rating cannot exceed 10'
    }),

  agility: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
    .messages({
      'any.required': 'Agility assessment is required',
      'number.base': 'Agility must be a number',
      'number.integer': 'Agility must be a whole number',
      'number.min': 'Agility rating must be at least 1',
      'number.max': 'Agility rating cannot exceed 10'
    }),

  ballControl: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
    .messages({
      'any.required': 'Ball control assessment is required',
      'number.base': 'Ball control must be a number',
      'number.integer': 'Ball control must be a whole number',
      'number.min': 'Ball control rating must be at least 1',
      'number.max': 'Ball control rating cannot exceed 10'
    }),

  passing: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
    .messages({
      'any.required': 'Passing assessment is required',
      'number.base': 'Passing must be a number',
      'number.integer': 'Passing must be a whole number',
      'number.min': 'Passing rating must be at least 1',
      'number.max': 'Passing rating cannot exceed 10'
    }),

  shooting: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
    .messages({
      'any.required': 'Shooting assessment is required',
      'number.base': 'Shooting must be a number',
      'number.integer': 'Shooting must be a whole number',
      'number.min': 'Shooting rating must be at least 1',
      'number.max': 'Shooting rating cannot exceed 10'
    }),

  defending: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
    .messages({
      'any.required': 'Defending assessment is required',
      'number.base': 'Defending must be a number',
      'number.integer': 'Defending must be a whole number',
      'number.min': 'Defending rating must be at least 1',
      'number.max': 'Defending rating cannot exceed 10'
    }),

  // ========================
  // ÉVALUATIONS MENTALES ET PHYSIQUES (1-10)
  // ========================

  gameIntelligence: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
    .messages({
      'any.required': 'Game intelligence assessment is required',
      'number.base': 'Game intelligence must be a number',
      'number.integer': 'Game intelligence must be a whole number',
      'number.min': 'Game intelligence rating must be at least 1',
      'number.max': 'Game intelligence rating cannot exceed 10'
    }),

  workEthic: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
    .messages({
      'any.required': 'Work ethic assessment is required',
      'number.base': 'Work ethic must be a number',
      'number.integer': 'Work ethic must be a whole number',
      'number.min': 'Work ethic rating must be at least 1',
      'number.max': 'Work ethic rating cannot exceed 10'
    }),

  physicalFitness: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
    .messages({
      'any.required': 'Physical fitness assessment is required',
      'number.base': 'Physical fitness must be a number',
      'number.integer': 'Physical fitness must be a whole number',
      'number.min': 'Physical fitness rating must be at least 1',
      'number.max': 'Physical fitness rating cannot exceed 10'
    }),

  leadership: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
    .messages({
      'any.required': 'Leadership assessment is required',
      'number.base': 'Leadership must be a number',
      'number.integer': 'Leadership must be a whole number',
      'number.min': 'Leadership rating must be at least 1',
      'number.max': 'Leadership rating cannot exceed 10'
    }),

  // ========================
  // SCORE GLOBAL CALCULÉ AUTOMATIQUEMENT
  // ========================

  overallScore: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .required()
    .messages({
      'any.required': 'Overall score is required',
      'number.base': 'Overall score must be a number',
      'number.integer': 'Overall score must be a whole number',
      'number.min': 'Overall score must be at least 1',
      'number.max': 'Overall score cannot exceed 10'
    }),

  // ========================
  // CHAMPS MÉTIER ET DISPONIBILITÉ
  // ========================

  availableToTransfer: Joi.boolean()
    .required()
    .messages({
      'any.required': 'Transfer availability status is required',
      'boolean.base': 'Transfer availability must be true or false'
    }),

  expectedGraduationDate: Joi.number()
    .integer()
    .min(2024)
    .max(2030)
    .required()
    .messages({
      'any.required': 'Expected graduation year is required',
      'number.base': 'Graduation year must be a number',
      'number.integer': 'Graduation year must be a whole number',
      'number.min': 'Graduation year cannot be before 2024',
      'number.max': 'Graduation year cannot be after 2030'
    }),

  // ========================
  // COMMENTAIRES TEXTUELS (VALIDATIONS STRICTES)
  // ========================

  coachabilityComment: Joi.string()
    .trim()
    .min(10)
    .max(500)
    .required()
    .messages({
      'any.required': 'Coachability assessment is required',
      'string.base': 'Coachability assessment must be text',
      'string.min': 'Please provide at least 10 characters for the coachability assessment',
      'string.max': 'Coachability assessment must not exceed 500 characters'
    }),

  technique: Joi.string()
    .trim()
    .min(10)
    .max(500)
    .required()
    .messages({
      'any.required': 'Technical assessment is required',
      'string.base': 'Technical assessment must be text',
      'string.min': 'Please provide at least 10 characters for the technical assessment',
      'string.max': 'Technical assessment must not exceed 500 characters'
    }),

  physique: Joi.string()
    .trim()
    .min(10)
    .max(500)
    .required()
    .messages({
      'any.required': 'Physical attributes assessment is required',
      'string.base': 'Physical assessment must be text',
      'string.min': 'Please provide at least 10 characters for the physical assessment',
      'string.max': 'Physical assessment must not exceed 500 characters'
    }),

  coachFinalComment: Joi.string()
    .trim()
    .min(20)
    .max(1500)
    .required()
    .messages({
      'any.required': 'Final coach comment is required',
      'string.base': 'Final comment must be text',
      'string.min': 'Please provide at least 20 characters for the final comment',
      'string.max': 'Final comment must not exceed 1500 characters'
    })

}).options({
  abortEarly: false,
  stripUnknown: true,
  presence: 'required'
});

/**
 * ✅ MIDDLEWARE PRINCIPAL DE VALIDATION
 * 
 * Ce middleware transforme automatiquement les noms de champs des tests
 * vers les noms attendus par le modèle Sequelize.
 */
const validatePlayerEvaluation = (req, res, next) => {
  console.log('🔍 Validating player evaluation data...');
  
  const { error, value } = playerEvaluationSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
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

  // ✅ TRANSFORMATION : Mapper areasForImprovement -> improvementAreas pour Sequelize (si nécessaire)
  if (value.areasForImprovement) {
    value.improvementAreas = value.areasForImprovement;
    delete value.areasForImprovement;
  }

  // ✅ TRANSFORMATION : Convertir expectedGraduationDate en integer si c'est une string
  if (typeof value.expectedGraduationDate === 'string') {
    value.expectedGraduationDate = parseInt(value.expectedGraduationDate, 10);
  }

  req.body = value;
  
  console.log(`✅ Player evaluation validation successful for ${Object.keys(value).length} fields`);
  
  next();
};

/**
 * ✅ MIDDLEWARE POUR LES MISES À JOUR D'ÉVALUATION
 */
const validatePlayerEvaluationUpdate = (req, res, next) => {
  const updateSchema = playerEvaluationSchema.fork(
    Object.keys(playerEvaluationSchema.describe().keys),
    schema => schema.optional()
  );

  const { error, value } = updateSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: 'Player evaluation update validation failed',
      code: 'EVALUATION_UPDATE_VALIDATION_ERROR',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }))
    });
  }

  if (Object.keys(value).length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'At least one field must be provided for evaluation update',
      code: 'NO_UPDATE_FIELDS'
    });
  }

  // Appliquer les mêmes transformations pour les updates
  if (value.areasForImprovement) {
    value.improvementAreas = value.areasForImprovement;
    delete value.areasForImprovement;
  }

  if (typeof value.expectedGraduationDate === 'string') {
    value.expectedGraduationDate = parseInt(value.expectedGraduationDate, 10);
  }

  req.body = value;
  next();
};

module.exports = {
  validatePlayerEvaluation,
  validatePlayerEvaluationUpdate,
  playerEvaluationSchema
};