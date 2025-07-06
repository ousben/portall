// portall/server/middleware/advancedValidation.js

const Joi = require('joi');
const { playerRegistrationSchema } = require('../validators/playerValidators');
const { coachRegistrationSchema } = require('../validators/coachValidators');
const { njcaaCoachRegistrationSchema } = require('../validators/njcaaCoachValidators'); // NOUVEAU
const { playerEvaluationSchema } = require('./playerEvaluationValidation'); // NOUVEAU

/**
 * Middleware de validation avancé étendu pour supporter tous les types d'utilisateurs
 * 
 * MISE À JOUR MAJEURE : Ajout du support complet pour les coachs NJCAA
 * avec leur propre schéma de validation et règles métier.
 * 
 * Ce middleware implémente une validation conditionnelle intelligente :
 * - Détecte automatiquement le type d'utilisateur
 * - Applique le schéma de validation approprié
 * - Effectue des validations croisées spécifiques à chaque type
 * - Enrichit les données avec des informations de référence
 */

/**
 * Middleware principal de validation d'inscription (ÉTENDU)
 * 
 * Cette fonction orchestre la validation complète selon le type d'utilisateur,
 * incluant maintenant le support des coachs NJCAA.
 */
const validateRegistration = async (req, res, next) => {
  try {
    const { userType } = req.body;

    console.log(`🔍 Advanced validation starting for user type: ${userType}`);

    // Vérifier que le type d'utilisateur est supporté
    const supportedTypes = ['player', 'coach', 'njcaa_coach']; // ÉTENDU
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
    let validationResult;

    switch (userType) {
      case 'player':
        validationSchema = playerRegistrationSchema;
        break;
        
      case 'coach':
        validationSchema = coachRegistrationSchema;
        break;
        
      case 'njcaa_coach':
        // NOUVEAU : Schéma spécialisé pour les coachs NJCAA
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
      validationResult = await validationSchema.validateAsync(req.body, {
        abortEarly: false,
        stripUnknown: true
      });
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

    // Effectuer des validations métier supplémentaires selon le type
    const businessValidation = await performBusinessValidation(userType, validationResult);
    if (!businessValidation.isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Business validation failed',
        code: 'BUSINESS_VALIDATION_ERROR',
        errors: businessValidation.errors,
        userType: userType
      });
    }

    // Remplacer les données de la requête par les données validées et enrichies
    req.body = validationResult;
    
    console.log(`✅ Advanced validation successful for ${userType}`);
    next();

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
 * NOUVEAU : Validation métier spécialisée par type d'utilisateur
 * 
 * Cette fonction effectue des vérifications métier complexes qui vont
 * au-delà de la validation de format. Elle inclut maintenant la logique
 * spécifique aux coachs NJCAA.
 */
const performBusinessValidation = async (userType, validatedData) => {
  const errors = [];

  try {
    switch (userType) {
      case 'player':
        // Validation métier existante pour les joueurs
        const playerValidation = await validatePlayerBusinessRules(validatedData);
        if (!playerValidation.isValid) {
          errors.push(...playerValidation.errors);
        }
        break;

      case 'coach':
        // Validation métier existante pour les coachs NCAA/NAIA
        const coachValidation = await validateCoachBusinessRules(validatedData);
        if (!coachValidation.isValid) {
          errors.push(...coachValidation.errors);
        }
        break;

      case 'njcaa_coach':
        // NOUVEAU : Validation métier pour les coachs NJCAA
        const njcaaCoachValidation = await validateNJCAACoachBusinessRules(validatedData);
        if (!njcaaCoachValidation.isValid) {
          errors.push(...njcaaCoachValidation.errors);
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };

  } catch (error) {
    console.error('Business validation error:', error);
    return {
      isValid: false,
      errors: [{
        field: 'general',
        message: 'Business validation system error'
      }]
    };
  }
};

/**
 * NOUVELLE FONCTION : Validation métier spécifique aux coachs NJCAA
 * 
 * Cette fonction implémente les règles métier spécifiques aux coachs NJCAA,
 * notamment la vérification de cohérence entre college et division.
 */
const validateNJCAACoachBusinessRules = async (data) => {
  const errors = [];
  const { NJCAACollege } = require('../models');

  try {
    // Règle 1 : Vérifier la cohérence college-division pour NJCAA
    if (data.collegeId && data.division) {
      let actualCollegeId;
      
      // Gérer les données enrichies par la validation Joi externe
      if (typeof data.collegeId === 'object' && data.collegeId.collegeId) {
        actualCollegeId = data.collegeId.collegeId;
      } else {
        actualCollegeId = data.collegeId;
      }

      try {
        const college = await NJCAACollege.findByPk(actualCollegeId);
        
        if (!college) {
          errors.push({
            field: 'collegeId',
            message: 'Selected NJCAA college does not exist'
          });
        } else if (!college.isActive) {
          errors.push({
            field: 'collegeId',
            message: 'Selected NJCAA college is not currently active'
          });
        } else {
          // Note : Si tu as des données de division par college,
          // tu peux ajouter ici une validation de cohérence
          // college.supportedDivisions.includes(data.division)
        }
      } catch (dbError) {
        errors.push({
          field: 'collegeId',
          message: 'Error validating NJCAA college'
        });
      }
    }

    // Règle 2 : Vérifier la cohérence position-responsabilités
    if (data.position && data.teamSport) {
      // Pour l'instant, toutes les combinaisons sont valides
      // Tu peux ajouter des règles spécifiques si nécessaire
    }

    // Règle 3 : Validation du numéro de téléphone selon le contexte géographique
    if (data.phoneNumber && data.collegeId) {
      // Tu peux ajouter des validations de format de téléphone
      // selon la région du college si nécessaire
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };

  } catch (error) {
    console.error('NJCAA coach business validation error:', error);
    return {
      isValid: false,
      errors: [{
        field: 'general',
        message: 'NJCAA coach validation system error'
      }]
    };
  }
};

/**
 * NOUVEAU : Middleware de validation pour les évaluations de joueurs
 * 
 * Ce middleware valide les données d'évaluation selon les spécifications
 * exactes que tu as fournies pour les coachs NJCAA.
 */
const validatePlayerEvaluation = async (req, res, next) => {
  try {
    console.log('🔍 Validating player evaluation data...');

    // Importer le schéma de validation des évaluations
    const { playerEvaluationSchema } = require('./playerEvaluationValidation');

    // Effectuer la validation
    const { error, value } = playerEvaluationSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      console.log('❌ Player evaluation validation failed:', error.details);
      
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

    // Validation métier supplémentaire pour les évaluations
    const businessValidation = await validateEvaluationBusinessRules(value);
    if (!businessValidation.isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Evaluation business validation failed',
        code: 'EVALUATION_BUSINESS_ERROR',
        errors: businessValidation.errors
      });
    }

    // Remplacer les données de la requête par les données validées
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

/**
 * NOUVELLE FONCTION : Validation métier pour les évaluations
 * 
 * Vérifie la cohérence et la qualité des données d'évaluation.
 */
const validateEvaluationBusinessRules = async (evaluationData) => {
  const errors = [];

  try {
    // Règle 1 : Vérifier la cohérence date de diplôme
    if (evaluationData.expectedGraduationDate) {
      const currentYear = new Date().getFullYear();
      const gradYear = evaluationData.expectedGraduationDate;
      
      if (gradYear < currentYear) {
        errors.push({
          field: 'expectedGraduationDate',
          message: 'Expected graduation date cannot be in the past'
        });
      }
      
      if (gradYear > currentYear + 6) {
        errors.push({
          field: 'expectedGraduationDate',
          message: 'Expected graduation date cannot be more than 6 years in the future'
        });
      }
    }

    // Règle 2 : Vérifier la qualité du contenu textuel
    const textFields = [
      'roleInTeam', 'performanceLevel', 'playerStrengths', 
      'improvementAreas', 'mentality', 'coachability', 
      'technique', 'physique', 'coachFinalComment'
    ];

    textFields.forEach(field => {
      if (evaluationData[field]) {
        const text = evaluationData[field].trim();
        
        // Vérifier qu'il ne s'agit pas de texte générique ou inutile
        const genericPhrases = ['N/A', 'n/a', 'None', 'none', '...', 'TBD', 'tbd'];
        if (genericPhrases.includes(text)) {
          errors.push({
            field: field,
            message: `Please provide a meaningful assessment for ${field}`
          });
        }
        
        // Vérifier la longueur minimale selon le champ
        const minLengths = {
          roleInTeam: 5,
          performanceLevel: 10,
          playerStrengths: 10,
          improvementAreas: 10,
          mentality: 10,
          coachability: 10,
          technique: 10,
          physique: 10,
          coachFinalComment: 20
        };
        
        if (text.length < minLengths[field]) {
          errors.push({
            field: field,
            message: `${field} requires at least ${minLengths[field]} characters for a meaningful assessment`
          });
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors: errors
    };

  } catch (error) {
    console.error('Evaluation business rules validation error:', error);
    return {
      isValid: false,
      errors: [{
        field: 'general',
        message: 'Evaluation business validation system error'
      }]
    };
  }
};

// Fonctions de validation métier existantes (inchangées)
const validatePlayerBusinessRules = async (data) => {
  // Code existant pour la validation des joueurs
  // ... (implémentation existante)
  return { isValid: true, errors: [] };
};

const validateCoachBusinessRules = async (data) => {
  // Code existant pour la validation des coachs NCAA/NAIA
  // ... (implémentation existante)
  return { isValid: true, errors: [] };
};

module.exports = {
  validateRegistration, // MISE À JOUR pour supporter njcaa_coach
  validatePlayerEvaluation, // NOUVEAU
  performBusinessValidation, // MISE À JOUR
  validateNJCAACoachBusinessRules, // NOUVEAU
  validateEvaluationBusinessRules // NOUVEAU
};