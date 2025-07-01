// portall/server/middleware/advancedValidation.js

const { playerRegistrationSchema, playerProfileUpdateSchema } = require('../validators/playerValidators');
const { coachRegistrationSchema, coachProfileUpdateSchema, validateCoachRegistrationData } = require('../validators/coachValidators');

/**
 * Middleware de validation avancé pour la Phase 3
 * 
 * Ce middleware gère :
 * - Validation conditionnelle selon le type d'utilisateur
 * - Validations asynchrones (vérifications en base de données)
 * - Messages d'erreur détaillés et structurés
 * - Optimisations de performance
 */

/**
 * Middleware principal de validation pour l'inscription
 * 
 * Ce middleware détermine automatiquement quel schéma utiliser
 * selon le type d'utilisateur et exécute les validations appropriées.
 */
const validateRegistration = async (req, res, next) => {
  try {
    const { userType } = req.body;

    console.log(`🔍 Validating registration for user type: ${userType}`);

    // ========================
    // DÉTERMINER LE SCHÉMA DE VALIDATION
    // ========================
    
    let schema;
    let additionalValidation = null;

    switch (userType) {
      case 'player':
        schema = playerRegistrationSchema;
        console.log('📋 Using player registration schema');
        break;

      case 'coach':
        schema = coachRegistrationSchema;
        additionalValidation = validateCoachRegistrationData;
        console.log('📋 Using coach registration schema with additional validations');
        break;

      default:
        return res.status(400).json({
          status: 'error',
          message: 'Invalid or missing user type',
          errors: [{
            field: 'userType',
            message: 'User type must be either "player" or "coach"'
          }]
        });
    }

    // ========================
    // VALIDATION JOI DE BASE
    // ========================
    
    console.log('🔍 Running Joi validation...');
    
    const validationResult = await schema.validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true,
      externals: true // Active les validations externes (async)
    });

    console.log('✅ Joi validation passed');

    // ========================
    // VALIDATION MÉTIER ADDITIONNELLE
    // ========================
    
    if (additionalValidation) {
      console.log('🔍 Running additional business logic validation...');
      
      const businessValidation = await additionalValidation(validationResult);
      
      if (!businessValidation.isValid) {
        console.log('❌ Business validation failed');
        
        return res.status(400).json({
          status: 'error',
          message: 'Business validation failed',
          errors: businessValidation.errors,
          warnings: businessValidation.warnings || []
        });
      }

      // Ajouter les données enrichies à la requête
      if (businessValidation.collegeData) {
        req.collegeData = businessValidation.collegeData;
      }

      if (businessValidation.warnings && businessValidation.warnings.length > 0) {
        req.validationWarnings = businessValidation.warnings;
      }

      console.log('✅ Business validation passed');
    }

    // ========================
    // SUCCÈS : ENRICHIR LA REQUÊTE
    // ========================
    
    // Remplacer les données de la requête par les données validées et nettoyées
    req.body = validationResult;
    
    // Marquer la validation comme réussie
    req.validationPassed = true;
    req.validationTimestamp = new Date();

    console.log('🎉 All validations passed successfully');
    
    next();

  } catch (error) {
    console.error('❌ Validation error:', error);

    // ========================
    // GESTION DES ERREURS DE VALIDATION
    // ========================
    
    if (error.isJoi) {
      // Erreur de validation Joi
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: validationErrors,
        details: {
          validatedFields: Object.keys(req.body),
          failedValidations: validationErrors.length
        }
      });
    }

    // Erreur inattendue
    return res.status(500).json({
      status: 'error',
      message: 'Validation process failed',
      ...(process.env.NODE_ENV === 'development' && { 
        debug: error.message,
        stack: error.stack 
      })
    });
  }
};

/**
 * Middleware de validation pour la mise à jour de profil
 * 
 * Plus permissif que l'inscription car permet la modification
 * de champs individuels sans re-valider tout le profil.
 */
const validateProfileUpdate = (userType) => {
  return async (req, res, next) => {
    try {
      console.log(`🔄 Validating profile update for user type: ${userType}`);

      let schema;

      switch (userType) {
        case 'player':
          schema = playerProfileUpdateSchema;
          break;

        case 'coach':
          schema = coachProfileUpdateSchema;
          break;

        default:
          return res.status(400).json({
            status: 'error',
            message: 'Invalid user type for profile update'
          });
      }

      // Validation avec options permissives pour la mise à jour
      const validationResult = await schema.validateAsync(req.body, {
        abortEarly: false,
        stripUnknown: true,
        presence: 'optional', // Tous les champs sont optionnels
        externals: true
      });

      // Si aucun champ n'est fourni, c'est une erreur
      if (Object.keys(validationResult).length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'No valid fields provided for update'
        });
      }

      req.body = validationResult;
      req.validationPassed = true;

      console.log(`✅ Profile update validation passed (${Object.keys(validationResult).length} fields)`);
      
      next();

    } catch (error) {
      console.error('❌ Profile update validation error:', error);

      if (error.isJoi) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        return res.status(400).json({
          status: 'error',
          message: 'Profile update validation failed',
          errors: validationErrors
        });
      }

      return res.status(500).json({
        status: 'error',
        message: 'Profile update validation process failed',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  };
};

/**
 * Middleware de validation pour les recherches de coachs
 * 
 * Valide les critères de recherche de joueurs par les coachs.
 */
const validatePlayerSearch = async (req, res, next) => {
  try {
    const searchSchema = Joi.object({
      // Critères de base
      gender: Joi.string().valid('male', 'female').optional(),
      collegeState: Joi.string().length(2).uppercase().optional(),
      collegeRegion: Joi.string().max(10).optional(),
      
      // Critères de profil
      profileStatus: Joi.string().valid('basic', 'completed', 'premium').optional(),
      minViews: Joi.number().integer().min(0).optional(),
      
      // Pagination
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      
      // Tri
      sortBy: Joi.string().valid('views', 'updated', 'created', 'name').default('views'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
      
    }).options({
      stripUnknown: true
    });

    const validatedQuery = await searchSchema.validateAsync(req.query);
    req.query = validatedQuery;
    
    console.log(`🔍 Player search validation passed with ${Object.keys(validatedQuery).length} criteria`);
    
    next();

  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid search criteria',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Search validation failed'
    });
  }
};

module.exports = {
  validateRegistration,
  validateProfileUpdate,
  validatePlayerSearch
};