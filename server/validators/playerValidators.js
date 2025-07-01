// portall/server/validators/playerValidators.js

const Joi = require('joi');
const { NJCAACollege } = require('../models');

/**
 * Validateurs spécialisés pour les profils joueurs NJCAA
 * 
 * Ces validateurs implémentent trois niveaux de contrôle :
 * 1. Syntaxe : Format des données
 * 2. Sémantique : Logique métier 
 * 3. Existentiel : Vérification en base de données
 * 
 * Chaque validateur est documenté avec sa logique métier spécifique.
 */

/**
 * Schéma de validation pour l'inscription complète d'un joueur
 * 
 * Ce schéma combine les champs utilisateur de base avec les champs
 * spécifiques au profil joueur. Il remplace l'ancien registerSchema
 * pour les utilisateurs de type 'player'.
 */
const playerRegistrationSchema = Joi.object({
  // ========================
  // CHAMPS UTILISATEUR DE BASE (hérités de l'ancien système)
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
    .valid('player')
    .required()
    .messages({
      'any.only': 'User type must be "player" for this registration form',
      'any.required': 'User type is required'
    }),

  // ========================
  // CHAMPS SPÉCIFIQUES AU PROFIL JOUEUR
  // ========================
  
  gender: Joi.string()
    .valid('male', 'female')
    .required()
    .messages({
      'any.only': 'Gender must be either "male" or "female"',
      'any.required': 'Gender selection is required for team placement'
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
      // Validation existentielle : vérifier que le college existe et est actif
      try {
        const college = await NJCAACollege.findByPk(value);
        
        if (!college) {
          throw new Error('Selected college does not exist');
        }
        
        if (!college.isActive) {
          throw new Error('Selected college is no longer accepting registrations');
        }
        
        // Retourner l'objet college pour utilisation ultérieure
        return { collegeId: value, collegeData: college };
        
      } catch (error) {
        throw new Error(`College validation failed: ${error.message}`);
      }
    }),

  // ========================
  // CHAMPS OPTIONNELS POUR ENRICHIR LE PROFIL
  // ========================
  
  termsAccepted: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'You must accept the terms and conditions to register',
      'any.required': 'Terms acceptance is required'
    }),

  newsletterOptIn: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Newsletter preference must be true or false'
    }),

  referralSource: Joi.string()
    .valid('social_media', 'coach_recommendation', 'college_counselor', 'friend', 'web_search', 'other')
    .optional()
    .messages({
      'any.only': 'Please select a valid referral source'
    })

}).options({
  // Options de validation globales
  abortEarly: false, // Collecte toutes les erreurs, pas seulement la première
  stripUnknown: true, // Supprime les champs non définis
  presence: 'required' // Par défaut, tous les champs sont requis sauf indication contraire
});

/**
 * Schéma de validation pour la mise à jour du profil joueur
 * 
 * Ce schéma est plus permissif que l'inscription car il permet
 * de modifier seulement certains champs sans re-valider tout.
 */
const playerProfileUpdateSchema = Joi.object({
  gender: Joi.string()
    .valid('male', 'female')
    .messages({
      'any.only': 'Gender must be either "male" or "female"'
    }),

  collegeId: Joi.number()
    .integer()
    .positive()
    .messages({
      'number.base': 'Invalid college selection',
      'number.integer': 'Invalid college selection',
      'number.positive': 'Invalid college selection'
    })
    .external(async (value, helpers) => {
      if (value) {
        try {
          const college = await NJCAACollege.findByPk(value);
          
          if (!college) {
            throw new Error('Selected college does not exist');
          }
          
          if (!college.isActive) {
            throw new Error('Selected college is no longer available');
          }
          
          return { collegeId: value, collegeData: college };
          
        } catch (error) {
          throw new Error(`College validation failed: ${error.message}`);
        }
      }
      return value;
    }),

  // Les autres champs ne peuvent pas être modifiés après inscription
  // (firstName, lastName, email nécessitent un processus de vérification séparé)

}).options({
  abortEarly: false,
  stripUnknown: true,
  presence: 'optional' // Tous les champs sont optionnels pour une mise à jour
});

/**
 * Validation spécialisée pour vérifier la cohérence college-genre
 * 
 * Certains colleges n'ont que des équipes masculines ou féminines.
 * Cette validation croisée s'assure de la compatibilité.
 */
const validateCollegeGenderCompatibility = async (collegeId, gender) => {
  try {
    const college = await NJCAACollege.findByPk(collegeId);
    
    if (!college) {
      return {
        isValid: false,
        error: 'College not found'
      };
    }

    // Note : Cette logique pourrait être étendue si nous avions des données
    // sur les programmes spécifiques de chaque college (équipes masculines/féminines)
    // Pour l'instant, nous assumons que tous les colleges NJCAA ont les deux
    
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
  playerRegistrationSchema,
  playerProfileUpdateSchema,
  validateCollegeGenderCompatibility
};