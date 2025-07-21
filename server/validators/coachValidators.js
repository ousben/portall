// portall/server/validators/coachValidators.js

const Joi = require('joi');
const { NCAACollege } = require('../models');

/**
 * Validateurs spécialisés pour les profils coachs NCAA/NAIA
 * 
 * Les coachs ont des validations plus complexes car :
 * - Ils doivent correspondre à la division de leur college
 * - Leur position et sport doivent être cohérents
 * - Leurs informations de contact sont critiques pour le recrutement
 */

/**
 * Schéma de validation pour l'inscription complète d'un coach
 * 
 * Ce schéma implémente des validations croisées sophistiquées pour
 * s'assurer que toutes les informations du coach sont cohérentes.
 */
const coachRegistrationSchema = Joi.object({
  // ========================
  // CHAMPS UTILISATEUR DE BASE
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
    .pattern(/^[A-Za-zÀ-ÿ\s\-']+$/)
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
    .valid('coach')
    .required()
    .messages({
      'any.only': 'User type must be "coach" for this registration form',
      'any.required': 'User type is required'
    }),

  // ========================
  // CHAMPS SPÉCIFIQUES AU PROFIL COACH
  // ========================
  
  position: Joi.string()
    .valid('head_coach', 'assistant_coach', 'staff_member')
    .required()
    .messages({
      'any.only': 'Position must be Head Coach, Assistant Coach, or Staff Member',
      'any.required': 'Please specify your coaching position'
    }),

  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/) // Format international E.164 simplifié
    .min(10)
    .max(20)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number (including country code if international)',
      'string.min': 'Phone number must be at least 10 digits long',
      'string.max': 'Phone number must not exceed 20 characters',
      'any.required': 'Phone number is required for recruiting contact'
    })
    .custom((value, helpers) => {
      // Nettoyage et normalisation du numéro de téléphone
      const cleanNumber = value.replace(/[\s\-\(\)]/g, '');
      
      // Vérification supplémentaire pour les numéros US
      if (cleanNumber.length === 10 && !cleanNumber.startsWith('+')) {
        // Numéro US sans indicatif pays
        return `+1${cleanNumber}`;
      }
      
      return cleanNumber;
    }),

  division: Joi.string()
    .valid('ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia')
    .required()
    .messages({
      'any.only': 'Division must be one of: NCAA D1, NCAA D2, NCAA D3, or NAIA',
      'any.required': 'Please specify your college division'
    }),

  teamSport: Joi.string()
    .valid('mens_soccer', 'womens_soccer')
    .required()
    .messages({
      'any.only': 'Team sport must be Men\'s Soccer or Women\'s Soccer',
      'any.required': 'Please specify which team you coach'
    }),

  collegeId: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'College selection is required',
      'number.integer': 'Invalid college selection',
      'number.positive': 'Invalid college selection',
      'any.required': 'Please select your college'
    }),

  // ========================
  // CHAMPS OPTIONNELS
  // ========================
  
  termsAccepted: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'You must accept the terms and conditions to register',
      'any.required': 'Terms acceptance is required'
    }),

  coachingExperience: Joi.number()
    .integer()
    .min(0)
    .max(50)
    .optional()
    .messages({
      'number.base': 'Coaching experience must be a number',
      'number.integer': 'Coaching experience must be a whole number of years',
      'number.min': 'Coaching experience cannot be negative',
      'number.max': 'Please contact support if you have more than 50 years of experience'
    }),

  specializations: Joi.array()
    .items(Joi.string().valid('goalkeeping', 'defense', 'midfield', 'attack', 'fitness', 'tactics'))
    .max(6)
    .optional()
    .messages({
      'array.max': 'Please select a maximum of 6 specializations'
    })

}).options({
  abortEarly: false,
  stripUnknown: true,
  presence: 'required'
});

/**
 * Validation existentielle et croisée spécifique aux coachs
 * 
 * Cette validation est appelée après la validation Joi de base pour
 * vérifier les cohérences métier complexes.
 */
const validateCoachRegistrationData = async (data) => {
  const errors = [];

  try {
    // ========================
    // VALIDATION EXISTENTIELLE : Le college existe-t-il ?
    // ========================
    
    const college = await NCAACollege.findByPk(data.collegeId);
    
    if (!college) {
      errors.push({
        field: 'collegeId',
        message: 'Selected college does not exist'
      });
      // Si le college n'existe pas, on ne peut pas faire les autres validations
      return {
        isValid: false,
        errors: errors
      };
    }

    if (!college.isActive) {
      errors.push({
        field: 'collegeId',
        message: 'Selected college is not currently active in our system'
      });
    }

    // ========================
    // VALIDATION CROISÉE : Division cohérente ?
    // ========================
    
    if (college.division !== data.division) {
      errors.push({
        field: 'division',
        message: `Division mismatch: ${college.name} is ${college.division}, but you selected ${data.division}`
      });
    }

    // ========================
    // VALIDATION MÉTIER : Logique de coaching
    // ========================
    
    // Un head coach devrait avoir plus d'expérience (règle business optionnelle)
    if (data.position === 'head_coach' && data.coachingExperience !== undefined && data.coachingExperience < 2) {
      // Ceci est un warning, pas une erreur bloquante
      errors.push({
        field: 'coachingExperience',
        message: 'Head coaches typically have at least 2 years of experience',
        severity: 'warning'
      });
    }

    // ========================
    // VALIDATION DE COHÉRENCE : Spécialisations vs sport
    // ========================
    
    if (data.specializations && data.specializations.includes('goalkeeping')) {
      // Les gardiens de but existent dans les deux sports, pas de problème
    }

    return {
      isValid: errors.filter(e => e.severity !== 'warning').length === 0,
      errors: errors,
      warnings: errors.filter(e => e.severity === 'warning'),
      collegeData: college
    };

  } catch (error) {
    return {
      isValid: false,
      errors: [{
        field: 'general',
        message: `Validation process failed: ${error.message}`
      }]
    };
  }
};

/**
 * Schéma de validation pour la mise à jour du profil coach
 */
const coachProfileUpdateSchema = Joi.object({
  position: Joi.string()
    .valid('head_coach', 'assistant_coach')
    .messages({
      'any.only': 'Position must be either "head_coach" or "assistant_coach"'
    }),

  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .min(10)
    .max(20)
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'string.min': 'Phone number must be at least 10 digits long',
      'string.max': 'Phone number must not exceed 20 characters'
    })
    .custom((value, helpers) => {
      const cleanNumber = value.replace(/[\s\-\(\)]/g, '');
      if (cleanNumber.length === 10 && !cleanNumber.startsWith('+')) {
        return `+1${cleanNumber}`;
      }
      return cleanNumber;
    }),

  teamSport: Joi.string()
    .valid('mens_soccer', 'womens_soccer')
    .messages({
      'any.only': 'Team sport must be either "mens_soccer" or "womens_soccer"'
    }),

  coachingExperience: Joi.number()
    .integer()
    .min(0)
    .max(50)
    .messages({
      'number.base': 'Coaching experience must be a number',
      'number.integer': 'Coaching experience must be a whole number of years',
      'number.min': 'Coaching experience cannot be negative',
      'number.max': 'Please contact support if you have more than 50 years of experience'
    }),

  specializations: Joi.array()
    .items(Joi.string().valid('goalkeeping', 'defense', 'midfield', 'attack', 'fitness', 'tactics'))
    .max(6)
    .messages({
      'array.max': 'Please select a maximum of 6 specializations'
    })

  // Note : division et collegeId ne peuvent pas être modifiés après inscription
  // (cela nécessiterait un processus de vérification séparé)

}).options({
  abortEarly: false,
  stripUnknown: true,
  presence: 'optional'
});

module.exports = {
  coachRegistrationSchema,
  coachProfileUpdateSchema,
  validateCoachRegistrationData
};