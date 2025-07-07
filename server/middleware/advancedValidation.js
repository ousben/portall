// portall/server/middleware/advancedValidation.js

const Joi = require('joi');
const { playerRegistrationSchema } = require('../validators/playerValidators');
const { coachRegistrationSchema } = require('../validators/coachValidators');
const { njcaaCoachRegistrationSchema } = require('../validators/njcaaCoachValidators');

/**
 * 🔧 Middleware de validation avancé COMPLET avec toutes les fonctions nécessaires
 * 
 * CORRECTION MAJEURE : Suppression de l'import inutile de playerEvaluationSchema
 * qui créait une confusion avec le middleware dédié.
 * 
 * 🎯 Fonctions exportées :
 * - validateRegistration : Validation d'inscription conditionnelle par type
 * - validateProfileUpdate : Validation de mise à jour de profil
 * - validatePlayerSearch : Validation des critères de recherche
 * 
 * 🏗️ Architecture pédagogique : Ce fichier illustre l'importance de maintenir
 * une correspondance exacte entre les imports et les exports pour éviter
 * les erreurs `undefined` difficiles à diagnostiquer.
 */

/**
 * 📝 Middleware principal de validation d'inscription (ÉTENDU)
 * 
 * Cette fonction orchestre la validation complète selon le type d'utilisateur,
 * incluant maintenant le support des coachs NJCAA.
 */
const validateRegistration = async (req, res, next) => {
  try {
    console.log(`🔍 Validating registration for user type: ${req.body.userType}`);
    
    let validationSchema;
    
    // Sélection du schéma approprié selon le type d'utilisateur
    switch (req.body.userType) {
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
          message: 'Invalid user type',
          code: 'INVALID_USER_TYPE',
          validTypes: ['player', 'coach', 'njcaa_coach']
        });
    }

    // Effectuer la validation
    const { error, value } = validationSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Registration validation failed',
        code: 'REGISTRATION_VALIDATION_ERROR',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type
        }))
      });
    }

    req.body = value;
    console.log(`✅ Registration validation successful for ${req.body.userType}`);
    next();

  } catch (error) {
    console.error('Registration validation error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Registration validation system error',
      code: 'REGISTRATION_VALIDATION_SYSTEM_ERROR'
    });
  }
};

/**
 * 📝 Middleware de validation pour les mises à jour de profil
 * 
 * Cette fonction valide les données lors de la mise à jour d'un profil existant.
 * Elle applique des règles moins strictes qu'à l'inscription.
 */
const validateProfileUpdate = async (req, res, next) => {
  try {
    console.log('🔍 Validating profile update...');

    // Schéma simplifié pour les mises à jour
    const updateSchema = Joi.object({
      firstName: Joi.string().min(2).max(50).trim().optional(),
      lastName: Joi.string().min(2).max(50).trim().optional(),
      phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
      bio: Joi.string().max(500).optional()
    }).options({
      stripUnknown: true,
      abortEarly: false
    });

    const { error, value } = updateSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Profile update validation failed',
        code: 'PROFILE_UPDATE_VALIDATION_ERROR',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.body = value;
    console.log('✅ Profile update validation successful');
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

/**
 * 🔍 Middleware de validation pour la recherche de joueurs
 * 
 * NOUVELLE FONCTION : Cette fonction était référencée mais n'existait pas,
 * causant des erreurs `undefined` dans l'application.
 */
const validatePlayerSearch = async (req, res, next) => {
  try {
    console.log('🔍 Validating player search criteria...');

    const searchSchema = Joi.object({
      position: Joi.string().optional(),
      gender: Joi.string().valid('male', 'female').optional(),
      collegeId: Joi.number().integer().positive().optional(),
      graduationYear: Joi.number().integer().min(2020).max(2030).optional(),
      currentYear: Joi.string().valid('freshman', 'sophomore', 'junior', 'senior').optional(),
      availableToTransfer: Joi.boolean().optional(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    }).options({
      stripUnknown: true,
      abortEarly: false
    });

    const { error, value } = searchSchema.validate(req.query);

    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Player search validation failed',
        code: 'PLAYER_SEARCH_VALIDATION_ERROR',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.query = value;
    console.log('✅ Player search validation successful');
    next();

  } catch (error) {
    console.error('Player search validation error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Player search validation system error',
      code: 'PLAYER_SEARCH_VALIDATION_SYSTEM_ERROR'
    });
  }
};

// 🎯 EXPORT COMPLET avec TOUTES les fonctions nécessaires
module.exports = {
  validateRegistration,
  validateProfileUpdate,
  validatePlayerSearch
};