// portall/server/middleware/advancedValidation.js

const Joi = require('joi');
const { playerRegistrationSchema } = require('../validators/playerValidators');
const { coachRegistrationSchema } = require('../validators/coachValidators');
const { njcaaCoachRegistrationSchema } = require('../validators/njcaaCoachValidators');

/**
 * 🔧 Middleware de validation avancé COMPLET avec toutes les fonctions nécessaires
 * 
 * ARCHITECTURE CORRIGÉE : Respect des signatures originales et ajout des fonctions manquantes
 * 
 * 🎯 Fonctions exportées :
 * - validateRegistration : Validation d'inscription conditionnelle par type
 * - validateProfileUpdate : Factory de middleware de mise à jour de profil  
 * - validatePlayerSearch : Validation des critères de recherche
 * 
 * 🏗️ Principe pédagogique : Ce fichier illustre l'importance de maintenir
 * la compatibilité des interfaces lors des modifications de code.
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
 * ✏️ FONCTION FACTORY : Middleware de validation pour les mises à jour de profil
 * 
 * SIGNATURE RESTAURÉE : Cette fonction retourne un middleware configuré pour
 * un type d'utilisateur spécifique. Elle peut aussi être utilisée directement
 * sans paramètre pour une validation générique.
 * 
 * 🔧 Usage :
 * - validateProfileUpdate('coach') - retourne middleware spécialisé coach
 * - validateProfileUpdate('player') - retourne middleware spécialisé joueur  
 * - validateProfileUpdate() - validation générique (pour compatibilité)
 */
const validateProfileUpdate = (userType = 'generic') => {
  return (req, res, next) => {
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
          phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(20).optional(),
          bio: Joi.string().max(500).optional()
        });
      } else {
        // Validation générique pour compatibilité descendante
        updateSchema = Joi.object({
          firstName: Joi.string().min(2).max(50).trim().optional(),
          lastName: Joi.string().min(2).max(50).trim().optional(),
          phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(20).optional(),
          bio: Joi.string().max(500).optional()
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
 * 🔍 Middleware de validation pour les recherches de joueurs
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
const validatePlayerSearch = (req, res, next) => {
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

      // Critères académiques et temporels
      graduationYear: Joi.array().items(
        Joi.number().integer().min(2024).max(2030)
      ).optional(),

      currentYear: Joi.array().items(
        Joi.string().valid('freshman', 'sophomore', 'junior', 'senior')
      ).optional(),

      gpaRange: Joi.object({
        min: Joi.number().min(0).max(4.0).optional(),
        max: Joi.number().min(0).max(4.0).optional()
      }).optional(),

      // Critères de disponibilité
      availableToTransfer: Joi.boolean().optional(),
      
      transferStatus: Joi.array().items(
        Joi.string().valid('not_transferring', 'considering', 'actively_looking')
      ).optional(),

      // Critères géographiques
      states: Joi.array().items(Joi.string().length(2)).optional(),
      regions: Joi.array().items(Joi.string()).optional(),

      // Critères de métadonnées
      gender: Joi.string().valid('male', 'female').optional(),
      isProfileVisible: Joi.boolean().default(true),

      // Pagination et tri
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      sortBy: Joi.string().valid('name', 'graduationYear', 'gpa', 'height', 'lastActive').default('lastActive'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')

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

/**
 * 🔍 Middleware de validation générique pour les paramètres d'ID
 * 
 * Cette fonction utilitaire valide que les paramètres d'URL contiennent
 * des IDs valides (entiers positifs).
 */
const validateIdParams = (paramNames = ['id']) => {
  return (req, res, next) => {
    try {
      const paramSchema = Joi.object(
        paramNames.reduce((schema, paramName) => {
          schema[paramName] = Joi.number().integer().positive().required();
          return schema;
        }, {})
      );

      const { error, value } = paramSchema.validate(req.params);

      if (error) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid ID parameter(s)',
          code: 'INVALID_ID_PARAMS',
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
      }

      req.params = { ...req.params, ...value };
      next();

    } catch (error) {
      console.error('ID parameters validation error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'ID validation system error',
        code: 'ID_VALIDATION_SYSTEM_ERROR'
      });
    }
  };
};

/**
 * 📊 Middleware de validation pour les requêtes de pagination
 * 
 * Cette fonction standardise la validation de pagination à travers l'application.
 */
const validatePagination = (req, res, next) => {
  try {
    const paginationSchema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    }).unknown(true); // Permettre d'autres paramètres

    const { error, value } = paginationSchema.validate(req.query);

    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Pagination validation failed',
        code: 'PAGINATION_VALIDATION_ERROR',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.query = value;
    next();

  } catch (error) {
    console.error('Pagination validation error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Pagination validation system error',
      code: 'PAGINATION_VALIDATION_SYSTEM_ERROR'
    });
  }
};

// 🎯 EXPORT COMPLET avec TOUTES les fonctions nécessaires
module.exports = {
  validateRegistration,
  validateProfileUpdate,
  validatePlayerSearch,
  validateIdParams,
  validatePagination
};