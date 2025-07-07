// portall/server/middleware/playerEvaluationValidation.js

const Joi = require('joi');

/**
 * 🎯 SCHÉMA CORRIGÉ : Aligné avec le modèle Sequelize ET les tests
 * 
 * Cette version résout les incohérences entre Joi, Sequelize et les tests
 * en utilisant les noms de champs des tests mais les contraintes du modèle.
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

  // ✅ CORRIGÉ : INTEGER pour correspondre au modèle Sequelize
  expectedGraduationDate: Joi.number()
    .integer()
    .min(new Date().getFullYear()) 
    .max(new Date().getFullYear() + 6)
    .required()
    .messages({
      'any.required': 'Expected graduation year is required',
      'number.base': 'Graduation year must be a valid year',
      'number.integer': 'Graduation year must be a valid year',
      'number.min': 'Graduation year cannot be in the past',
      'number.max': 'Graduation year cannot be more than 6 years in the future'
    }),

  // ========================
  // QUESTIONS OUVERTES ✅ LONGUEURS ALIGNÉES AVEC LE MODÈLE SEQUELIZE
  // ========================
  
  roleInTeam: Joi.string()
    .trim()
    .min(5) // ✅ ALIGNÉ avec le modèle Sequelize
    .max(500)
    .required()
    .messages({
      'any.required': 'Player\'s role in team is required',
      'string.base': 'Role description must be text',
      'string.min': 'Please provide at least 5 characters for the role description',
      'string.max': 'Role description must not exceed 500 characters'
    }),

  performanceLevel: Joi.string()
    .trim()
    .min(10) // ✅ ALIGNÉ avec le modèle Sequelize
    .max(1000)
    .required()
    .messages({
      'any.required': 'Performance level assessment is required',
      'string.base': 'Performance level must be text',
      'string.min': 'Please provide at least 10 characters for the performance level assessment',
      'string.max': 'Performance level assessment must not exceed 1000 characters'
    }),

  playerStrengths: Joi.string()
    .trim()
    .min(10) // ✅ ALIGNÉ avec le modèle Sequelize
    .max(1000)
    .required()
    .messages({
      'any.required': 'Player strengths assessment is required',
      'string.base': 'Player strengths must be text',
      'string.min': 'Please provide at least 10 characters for the strengths assessment',
      'string.max': 'Strengths assessment must not exceed 1000 characters'
    }),

  // ✅ GARDE LE NOM DU TEST mais mappe vers le modèle Sequelize
  areasForImprovement: Joi.string()
    .trim()
    .min(10) // ✅ ALIGNÉ avec le modèle Sequelize
    .max(1000)
    .required()
    .messages({
      'any.required': 'Areas for improvement assessment is required',
      'string.base': 'Areas for improvement must be text',
      'string.min': 'Please provide at least 10 characters for the areas for improvement',
      'string.max': 'Areas for improvement must not exceed 1000 characters'
    }),

  mentality: Joi.string()
    .trim()
    .min(10) // ✅ ALIGNÉ avec le modèle Sequelize
    .max(500)
    .required()
    .messages({
      'any.required': 'Mentality assessment is required',
      'string.base': 'Mentality assessment must be text',
      'string.min': 'Please provide at least 10 characters for the mentality assessment',
      'string.max': 'Mentality assessment must not exceed 500 characters'
    }),

  coachability: Joi.string()
    .trim()
    .min(10) // ✅ ALIGNÉ avec le modèle Sequelize
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
    .min(10) // ✅ ALIGNÉ avec le modèle Sequelize
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
    .min(10) // ✅ ALIGNÉ avec le modèle Sequelize
    .max(500)
    .required()
    .messages({
      'any.required': 'Physical attributes assessment is required',
      'string.base': 'Physical assessment must be text',
      'string.min': 'Please provide at least 10 characters for the physical assessment',
      'string.max': 'Physical assessment must not exceed 500 characters'
    }),

  // ========================
  // COMMENTAIRE FINAL (SYNTHÈSE ET RECOMMANDATIONS)
  // ========================
  
  coachFinalComment: Joi.string()
    .trim()
    .min(20) // ✅ ALIGNÉ avec le modèle Sequelize
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
 * ✅ MIDDLEWARE AVEC TRANSFORMATION DE CHAMPS
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

  // ✅ TRANSFORMATION : Mapper areasForImprovement -> improvementAreas pour Sequelize
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
  playerEvaluationSchema,
  playerEvaluationUpdateSchema: playerEvaluationSchema.fork(
    Object.keys(playerEvaluationSchema.describe().keys),
    schema => schema.optional()
  )
};