// portall/server/validators/njcaaCoachValidators.js

const Joi = require('joi');
const { NJCAACollege } = require('../models');

/**
 * Validateurs spécialisés pour les profils coachs NJCAA
 * 
 * Ces validateurs implémentent la logique métier spécifique aux coachs NJCAA :
 * - Validation des colleges NJCAA (pas NCAA)
 * - Divisions NJCAA spécifiques (D1, D2, D3 seulement)
 * - Cohérence entre college sélectionné et division déclarée
 * - Numéros de téléphone professionnels valides
 * 
 * Architecture : Suit le même pattern que playerValidators.js pour
 * maintenir la cohérence dans votre codebase.
 */

/**
 * Schéma de validation pour l'inscription complète d'un coach NJCAA
 * 
 * Ce schéma combine les champs utilisateur de base avec les champs
 * spécifiques au profil coach NJCAA. Il remplace l'ancien registerSchema
 * pour les utilisateurs de type 'njcaa_coach'.
 */
const njcaaCoachRegistrationSchema = Joi.object({
  // ========================
  // CHAMPS UTILISATEUR DE BASE (identiques aux autres types)
  // ========================
  
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .trim()
    .max(255)
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
      'string.max': 'Email must not exceed 255 characters'
    }),

  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Password confirmation is required'
    }),

  firstName: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[A-Za-zÀ-ÿ\s\-']+$/) // Accepte les accents, espaces, tirets, apostrophes
    .trim()
    .required()
    .messages({
      'string.min': 'First name must be at least 2 characters long',
      'string.max': 'First name must not exceed 50 characters',
      'string.pattern.base': 'First name must contain only letters, spaces, hyphens, and apostrophes',
      'any.required': 'First name is required'
    }),

  lastName: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[A-Za-zÀ-ÿ\s\-']+$/)
    .trim()
    .required()
    .messages({
      'string.min': 'Last name must be at least 2 characters long',
      'string.max': 'Last name must not exceed 50 characters',
      'string.pattern.base': 'Last name must contain only letters, spaces, hyphens, and apostrophes',
      'any.required': 'Last name is required'
    }),

  userType: Joi.string()
    .valid('njcaa_coach')
    .required()
    .messages({
      'any.only': 'User type must be "njcaa_coach" for this registration form',
      'any.required': 'User type is required'
    }),

  // ========================
  // CHAMPS SPÉCIFIQUES AU PROFIL COACH NJCAA
  // ========================
  
  position: Joi.string()
    .valid('head_coach', 'assistant_coach')
    .required()
    .messages({
      'any.only': 'Position must be either "Head Coach" or "Assistant Coach"',
      'any.required': 'Please specify your coaching position'
    }),

  phoneNumber: Joi.string()
    .pattern(/^\+?[\d\s\-\(\)]+$/) // Format flexible pour numéros internationaux
    .min(10)
    .max(20)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'string.min': 'Phone number must be at least 10 characters',
      'string.max': 'Phone number must not exceed 20 characters',
      'any.required': 'Phone number is required for coaching contact'
    }),

  collegeId: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'College selection is required',
      'number.integer': 'Invalid college selection',
      'number.positive': 'Invalid college selection',
      'any.required': 'Please select your NJCAA college'
    })
    .external(async (value, helpers) => {
      // Validation existentielle : vérifier que le college NJCAA existe et est actif
      try {
        const college = await NJCAACollege.findByPk(value);
        
        if (!college) {
          throw new Error('Selected college does not exist');
        }
        
        if (!college.isActive) {
          throw new Error('Selected college is no longer accepting registrations');
        }
        
        // Retourner l'objet college pour utilisation ultérieure dans la validation croisée
        return { collegeId: value, collegeData: college };
        
      } catch (error) {
        throw new Error(`College validation failed: ${error.message}`);
      }
    }),

  division: Joi.string()
    .valid('njcaa_d1', 'njcaa_d2', 'njcaa_d3')
    .required()
    .messages({
      'any.only': 'Division must be NJCAA D1, NJCAA D2, or NJCAA D3',
      'any.required': 'Please select your college\'s NJCAA division'
    }),

  teamSport: Joi.string()
    .valid('mens_soccer', 'womens_soccer')
    .required()
    .messages({
      'any.only': 'Team sport must be either Men\'s Soccer or Women\'s Soccer',
      'any.required': 'Please specify which team you coach'
    }),

  // ========================
  // CHAMPS OBLIGATOIRES POUR VALIDATION ADMIN
  // ========================
  
  termsAccepted: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'You must accept the terms and conditions to register',
      'any.required': 'Terms acceptance is required'
    })

}).options({
  // Options de validation globales
  abortEarly: false, // Collecte toutes les erreurs, pas seulement la première
  stripUnknown: true, // Supprime les champs non définis
  presence: 'required' // Par défaut, tous les champs sont requis sauf indication contraire
});

/**
 * Schéma de validation pour la mise à jour du profil coach NJCAA
 * 
 * Ce schéma est plus permissif que l'inscription car il permet
 * de modifier seulement certains champs sans re-valider tout.
 */
const njcaaCoachProfileUpdateSchema = Joi.object({
  position: Joi.string()
    .valid('head_coach', 'assistant_coach')
    .messages({
      'any.only': 'Position must be either "Head Coach" or "Assistant Coach"'
    }),

  phoneNumber: Joi.string()
    .pattern(/^\+?[\d\s\-\(\)]+$/)
    .min(10)
    .max(20)
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'string.min': 'Phone number must be at least 10 characters',
      'string.max': 'Phone number must not exceed 20 characters'
    }),

  division: Joi.string()
    .valid('njcaa_d1', 'njcaa_d2', 'njcaa_d3')
    .messages({
      'any.only': 'Division must be NJCAA D1, NJCAA D2, or NJCAA D3'
    }),

  teamSport: Joi.string()
    .valid('mens_soccer', 'womens_soccer')
    .messages({
      'any.only': 'Team sport must be either Men\'s Soccer or Women\'s Soccer'
    }),

  // Note: Le college ne peut pas être modifié après inscription
  // (nécessiterait un processus de vérification séparé)

}).options({
  abortEarly: false,
  stripUnknown: true,
  presence: 'optional' // Tous les champs sont optionnels pour une mise à jour
});

/**
 * Validation spécialisée pour vérifier la cohérence college-division
 * 
 * Certains colleges NJCAA pourraient n'avoir que certaines divisions.
 * Cette validation croisée s'assure de la compatibilité.
 */
const validateCollegeDivisionCompatibility = async (collegeId, division) => {
  try {
    const college = await NJCAACollege.findByPk(collegeId);
    
    if (!college) {
      return {
        isValid: false,
        error: 'College not found'
      };
    }

    // Note : Cette logique pourrait être étendue si nous avions des données
    // sur les divisions spécifiques de chaque college NJCAA
    // Pour l'instant, nous assumons que tous les colleges NJCAA ont toutes les divisions
    
    return {
      isValid: true,
      collegeData: college
    };
    
  } catch (error) {
    return {
      isValid: false,
      error: `Validation error: ${error.message}`
    };
  }
};

module.exports = {
  njcaaCoachRegistrationSchema,
  njcaaCoachProfileUpdateSchema,
  validateCollegeDivisionCompatibility
};