// portall/server/middleware/advancedValidation.js

const Joi = require('joi');
const { playerRegistrationSchema } = require('../validators/playerValidators');
const { coachRegistrationSchema } = require('../validators/coachValidators');
const { njcaaCoachRegistrationSchema } = require('../validators/njcaaCoachValidators');
const { playerEvaluationSchema } = require('./playerEvaluationValidation');

/**
 * 🔧 Middleware de validation avancé COMPLET avec toutes les fonctions nécessaires
 * 
 * CORRECTION MAJEURE : Ajout de la fonction validatePlayerSearch manquante
 * qui était référencée dans les routes coaches mais n'existait pas.
 * 
 * 🎯 Fonctions exportées :
 * - validateRegistration : Validation d'inscription conditionnelle par type
 * - validateProfileUpdate : Validation de mise à jour de profil
 * - validatePlayerEvaluation : Validation des évaluations NJCAA
 * - validatePlayerSearch : Validation des critères de recherche [NOUVELLE]
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
        }))
      });
    }

  } catch (error) {
    console.error('Registration validation system error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Registration validation system error',
      code: 'REGISTRATION_VALIDATION_SYSTEM_ERROR'
    });
  }
};

/**
 * ✏️ Middleware de validation pour les mises à jour de profil
 * 
 * Cette fonction valide les données de mise à jour selon le type d'utilisateur.
 * Elle permet des validations partielles (tous les champs optionnels).
 */
const validateProfileUpdate = (userType) => {
  return async (req, res, next) => {
    try {
      console.log(`🔍 Validating profile update for user type: ${userType}`);

      // Définir les schémas de mise à jour selon le type
      let updateSchema;

      if (userType === 'player') {
        // Schéma simplifié pour les joueurs
        updateSchema = Joi.object({
          bio: Joi.string().max(500).optional(),
          instagramHandle: Joi.string().max(50).optional(),
          highlights: Joi.string().uri().optional(),
          transferStatus: Joi.string().valid('not_transferring', 'considering', 'actively_looking').optional(),
          achievements: Joi.string().max(1000).optional(),
          gpa: Joi.number().min(0).max(4.0).optional(),
          isProfileVisible: Joi.boolean().optional()
        });
      } else if (userType === 'coach') {
        // Schéma pour les coachs NCAA/NAIA
        updateSchema = Joi.object({
          phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(20).optional(),
          bio: Joi.string().max(500).optional(),
          recruitingPreferences: Joi.object().optional()
        });
      } else if (userType === 'njcaa_coach') {
        // Schéma pour les coachs NJCAA
        updateSchema = Joi.object({
          phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(20).optional()
        });
      } else {
        return res.status(400).json({
          status: 'error',
          message: `Profile update not supported for user type: ${userType}`,
          code: 'UNSUPPORTED_USER_TYPE'
        });
      }

      // Effectuer la validation
      const { error, value } = updateSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
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
 * 🔍 NOUVELLE FONCTION : Middleware de validation pour les recherches de joueurs
 * 
 * Cette fonction valide les critères de recherche que les coachs utilisent
 * pour trouver des joueurs correspondant à leurs besoins.
 * 
 * 🎯 Critères supportés :
 * - Position de jeu
 * - Tranche d'âge
 * - Taille/poids
 * - Niveau académique
 * - Disponibilité transfert
 * - Localisation géographique
 */
const validatePlayerSearch = async (req, res, next) => {
  try {
    console.log('🔍 Validating player search criteria...');

    // Schéma de validation pour les critères de recherche
    const searchSchema = Joi.object({
      // Critères de jeu
      position: Joi.array().items(
        Joi.string().valid(
          'goalkeeper', 'center_back', 'full_back', 'wing_back',
          'defensive_midfielder', 'central_midfielder', 'attacking_midfielder',
          'winger', 'striker', 'forward'
        )
      ).optional(),

      // Critères physiques
      heightRange: Joi.object({
        min: Joi.number().min(150).max(220).optional(),
        max: Joi.number().min(150).max(220).optional()
      }).optional(),

      weightRange: Joi.object({
        min: Joi.number().min(50).max(150).optional(),
        max: Joi.number().min(50).max(150).optional()
      }).optional(),

      // Critères démographiques
      ageRange: Joi.object({
        min: Joi.number().min(16).max(30).optional(),
        max: Joi.number().min(16).max(30).optional()
      }).optional(),

      gender: Joi.string().valid('male', 'female').optional(),

      // Critères académiques
      gpaRange: Joi.object({
        min: Joi.number().min(0).max(4.0).optional(),
        max: Joi.number().min(0).max(4.0).optional()
      }).optional(),

      currentYear: Joi.array().items(
        Joi.string().valid('freshman', 'sophomore')
      ).optional(),

      graduationYear: Joi.array().items(
        Joi.number().min(2024).max(2030)
      ).optional(),

      // Critères de transfert
      transferStatus: Joi.array().items(
        Joi.string().valid('not_transferring', 'considering', 'actively_looking')
      ).optional(),

      // Critères géographiques
      states: Joi.array().items(
        Joi.string().length(2).uppercase() // Codes d'état US (ex: CA, TX, FL)
      ).optional(),

      regions: Joi.array().items(
        Joi.string().valid('Northeast', 'Southeast', 'Midwest', 'Southwest', 'West')
      ).optional(),

      // Critères de recherche avancés
      keywords: Joi.string().max(100).optional(),
      
      // Métadonnées de recherche
      searchName: Joi.string().max(50).optional(), // Pour sauvegarder la recherche
      
      // Pagination et tri
      page: Joi.number().min(1).default(1).optional(),
      limit: Joi.number().min(1).max(50).default(20).optional(),
      sortBy: Joi.string().valid('relevance', 'gpa', 'age', 'height', 'weight', 'createdAt').default('relevance').optional(),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional()
    });

    // Effectuer la validation
    const { error, value } = searchSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Player search validation failed',
        code: 'PLAYER_SEARCH_VALIDATION_ERROR',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type
        }))
      });
    }

    // Validation logique : vérifier la cohérence des ranges
    const logicErrors = [];

    if (value.heightRange && value.heightRange.min && value.heightRange.max) {
      if (value.heightRange.min > value.heightRange.max) {
        logicErrors.push({
          field: 'heightRange',
          message: 'Minimum height cannot be greater than maximum height'
        });
      }
    }

    if (value.weightRange && value.weightRange.min && value.weightRange.max) {
      if (value.weightRange.min > value.weightRange.max) {
        logicErrors.push({
          field: 'weightRange',
          message: 'Minimum weight cannot be greater than maximum weight'
        });
      }
    }

    if (value.ageRange && value.ageRange.min && value.ageRange.max) {
      if (value.ageRange.min > value.ageRange.max) {
        logicErrors.push({
          field: 'ageRange',
          message: 'Minimum age cannot be greater than maximum age'
        });
      }
    }

    if (value.gpaRange && value.gpaRange.min && value.gpaRange.max) {
      if (value.gpaRange.min > value.gpaRange.max) {
        logicErrors.push({
          field: 'gpaRange',
          message: 'Minimum GPA cannot be greater than maximum GPA'
        });
      }
    }

    if (logicErrors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Player search logic validation failed',
        code: 'PLAYER_SEARCH_LOGIC_ERROR',
        errors: logicErrors
      });
    }

    req.body = value;
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

/**
 * 📝 Middleware de validation pour les évaluations de joueurs
 * 
 * Cette fonction valide les données d'évaluation selon le schéma défini
 * pour les coachs NJCAA qui évaluent leurs joueurs.
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

// 🎯 EXPORT COMPLET avec TOUTES les fonctions nécessaires
module.exports = {
  validateRegistration,
  validateProfileUpdate,
  validatePlayerEvaluation,
  validatePlayerSearch // ← FONCTION MANQUANTE AJOUTÉE !
}