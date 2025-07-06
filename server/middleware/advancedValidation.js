// portall/server/middleware/advancedValidation.js

const Joi = require('joi');
const { playerRegistrationSchema } = require('../validators/playerValidators');
const { coachRegistrationSchema } = require('../validators/coachValidators');
const { njcaaCoachRegistrationSchema } = require('../validators/njcaaCoachValidators');
const { playerEvaluationSchema } = require('./playerEvaluationValidation');

/**
 * Middleware de validation avancé complet avec toutes les fonctions nécessaires
 * 
 * CORRECTION : Ajout de la fonction validateProfileUpdate manquante
 * qui était référencée dans les routes mais n'existait pas.
 * 
 * Ce middleware gère maintenant TOUS les types d'utilisateurs :
 * - player (joueurs NJCAA)
 * - coach (coachs NCAA/NAIA) 
 * - njcaa_coach (coachs NJCAA)
 * - admin (administrateurs)
 */

/**
 * Middleware principal de validation d'inscription (ÉTENDU)
 */
const validateRegistration = async (req, res, next) => {
  try {
    const { userType } = req.body;

    console.log(`🔍 Advanced validation starting for user type: ${userType}`);

    // Vérifier que le type d'utilisateur est supporté
    const supportedTypes = ['player', 'coach', 'njcaa_coach'];
    if (!userType || !supportedTypes.includes(userType)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or missing user type',
        code: 'INVALID_USER_TYPE',
        supportedTypes: supportedTypes
      });
    }

    // Sélectionner et appliquer le schéma de validation approprié
    let validationSchema;

    switch (userType) {
      case 'player':
        validationSchema = playerRegistrationSchema;
        break;
      case 'coach':
        validationSchema = coachRegistrationSchema;
        break;
      case 'njcaa_coach':
        validationSchema = njcaaCoachRegistrationSchema;
        break;
      default:
        return res.status(400).json({
          status: 'error',
          message: `Validation schema not implemented for user type: ${userType}`,
          code: 'VALIDATION_SCHEMA_MISSING'
        });
    }

    // Effectuer la validation avec le schéma sélectionné
    try {
      const validationResult = await validationSchema.validateAsync(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      req.body = validationResult;
      console.log(`✅ Advanced validation successful for ${userType}`);
      next();

    } catch (validationError) {
      console.log(`❌ Validation failed for ${userType}:`, validationError.details);
      
      return res.status(400).json({
        status: 'error',
        message: `${userType} registration validation failed`,
        code: 'REGISTRATION_VALIDATION_ERROR',
        errors: validationError.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type
        })),
        userType: userType
      });
    }

  } catch (error) {
    console.error('Advanced validation middleware error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Validation system error',
      code: 'VALIDATION_SYSTEM_ERROR'
    });
  }
};

/**
 * FONCTION MANQUANTE : Middleware de validation pour les mises à jour de profil
 * 
 * Cette fonction était référencée dans les routes mais n'existait pas.
 * Elle valide les mises à jour de profil selon le type d'utilisateur.
 * 
 * @param {string} userType - Type d'utilisateur ('player', 'coach', 'njcaa_coach')
 * @returns {Function} Middleware function
 */
const validateProfileUpdate = (userType) => {
  return async (req, res, next) => {
    try {
      console.log(`🔍 Validating profile update for user type: ${userType}`);

      // Schémas de validation pour les mises à jour selon le type d'utilisateur
      let updateSchema;

      switch (userType) {
        case 'player':
          updateSchema = Joi.object({
            gender: Joi.string()
              .valid('male', 'female')
              .optional()
              .messages({
                'any.only': 'Gender must be either "male" or "female"'
              }),

            collegeId: Joi.number()
              .integer()
              .positive()
              .optional()
              .messages({
                'number.base': 'Invalid college selection',
                'number.integer': 'Invalid college selection',
                'number.positive': 'Invalid college selection'
              }),

            // Les informations de base ne peuvent pas être modifiées via cette route
            // (firstName, lastName, email nécessitent un processus de vérification séparé)

          }).options({
            abortEarly: false,
            stripUnknown: true,
            presence: 'optional' // Tous les champs sont optionnels pour une mise à jour
          });
          break;

        case 'coach':
          updateSchema = Joi.object({
            phoneNumber: Joi.string()
              .pattern(/^\+?[\d\s\-\(\)]+$/)
              .min(10)
              .max(20)
              .optional()
              .messages({
                'string.pattern.base': 'Please provide a valid phone number',
                'string.min': 'Phone number must be at least 10 characters',
                'string.max': 'Phone number must not exceed 20 characters'
              }),

            position: Joi.string()
              .valid('head_coach', 'assistant_coach')
              .optional()
              .messages({
                'any.only': 'Position must be either "Head Coach" or "Assistant Coach"'
              }),

            // Autres champs sensibles nécessitent validation admin
            // (college, division, teamSport)

          }).options({
            abortEarly: false,
            stripUnknown: true,
            presence: 'optional'
          });
          break;

        case 'njcaa_coach':
          updateSchema = Joi.object({
            phoneNumber: Joi.string()
              .pattern(/^\+?[\d\s\-\(\)]+$/)
              .min(10)
              .max(20)
              .optional()
              .messages({
                'string.pattern.base': 'Please provide a valid phone number',
                'string.min': 'Phone number must be at least 10 characters',
                'string.max': 'Phone number must not exceed 20 characters'
              }),

            // Autres champs nécessitent validation admin pour les coachs NJCAA
            // (position, college, division, teamSport)

          }).options({
            abortEarly: false,
            stripUnknown: true,
            presence: 'optional'
          });
          break;

        default:
          return res.status(400).json({
            status: 'error',
            message: `Profile update validation not implemented for user type: ${userType}`,
            code: 'UPDATE_VALIDATION_NOT_SUPPORTED'
          });
      }

      // Effectuer la validation
      const { error, value } = updateSchema.validate(req.body);

      if (error) {
        console.log(`❌ Profile update validation failed for ${userType}:`, error.details);
        
        return res.status(400).json({
          status: 'error',
          message: 'Profile update validation failed',
          code: 'PROFILE_UPDATE_VALIDATION_ERROR',
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type
          })),
          userType: userType
        });
      }

      // Vérifier qu'au moins un champ est fourni pour la mise à jour
      if (Object.keys(value).length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'At least one field must be provided for profile update',
          code: 'NO_UPDATE_FIELDS',
          userType: userType
        });
      }

      // Remplacer les données de la requête par les données validées
      req.body = value;
      
      console.log(`✅ Profile update validation successful for ${userType}`);
      next();

    } catch (error) {
      console.error('Profile update validation error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Profile update validation system error',
        code: 'PROFILE_UPDATE_VALIDATION_SYSTEM_ERROR'
      });
    }
  };
};

/**
 * Middleware de validation pour les évaluations de joueurs
 */
const validatePlayerEvaluation = async (req, res, next) => {
  try {
    console.log('🔍 Validating player evaluation data...');

    // Effectuer la validation
    const { error, value } = playerEvaluationSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Player evaluation validation failed',
        code: 'EVALUATION_VALIDATION_ERROR',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type
        }))
      });
    }

    req.body = value;
    console.log('✅ Player evaluation validation successful');
    next();

  } catch (error) {
    console.error('Player evaluation validation error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Evaluation validation system error',
      code: 'EVALUATION_VALIDATION_SYSTEM_ERROR'
    });
  }
};

// EXPORT COMPLET avec toutes les fonctions nécessaires
module.exports = {
  validateRegistration,
  validateProfileUpdate, // ← FONCTION MANQUANTE AJOUTÉE
  validatePlayerEvaluation
};