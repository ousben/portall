// portall/server/validators/playerValidators.js

const Joi = require('joi');
const { NJCAACollege } = require('../models');

/**
 * 🎓 Validateurs Spécialisés pour les Profils Joueurs NJCAA - VERSION CORRIGÉE COMPLÈTE
 * 
 * Cette version résout le problème critique identifié lors du debugging :
 * Le schéma original était incomplet et ne définissait pas tous les champs requis
 * par createPlayerProfile, ce qui causait leur suppression par stripUnknown: true.
 * 
 * 🏗️ Architecture de Validation à Trois Niveaux :
 * 1. Syntaxique : Format et type des données (ex: email valide, nombre entier)
 * 2. Sémantique : Logique métier (ex: âge réaliste, position valide)  
 * 3. Existentiel : Vérification en base de données (ex: college existe et actif)
 * 
 * 🎯 Principe Pédagogique Central :
 * Chaque champ est documenté avec sa raison d'être métier pour faciliter
 * la maintenance future et la compréhension de l'équipe.
 */

/**
 * 📋 Schéma de Validation pour l'Inscription Complète d'un Joueur
 * 
 * Ce schéma unifie la validation des données utilisateur de base avec
 * les exigences spécifiques du profil joueur. Il remplace l'ancien
 * registerSchema pour garantir une validation cohérente et complète.
 * 
 * 🔧 Correction Principale Appliquée :
 * Ajout de TOUS les champs requis par AuthController.createPlayerProfile
 * pour éviter leur suppression silencieuse par les options Joi.
 */
const playerRegistrationSchema = Joi.object({
  
  // ========================
  // 👤 CHAMPS UTILISATEUR DE BASE 
  // Ces champs sont communs à tous les types d'utilisateurs de Portall
  // ========================
  
  email: Joi.string()
    .email({ tlds: { allow: false } }) // Accepte tous les domaines pour flexibilité internationale
    .lowercase() // Normalisation automatique pour éviter les doublons
    .trim() // Suppression des espaces parasites
    .max(255) // Limite standard pour les champs email en base
    .required()
    .messages({
      'string.email': 'Veuillez fournir une adresse email valide',
      'any.required': 'L\'adresse email est requise',
      'string.max': 'L\'email ne doit pas dépasser 255 caractères'
    }),

  password: Joi.string()
    .min(8) // Sécurité minimale recommandée
    .max(128) // Évite les attaques par déni de service
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
      'string.max': 'Le mot de passe ne doit pas dépasser 128 caractères',
      'string.pattern.base': 'Le mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial',
      'any.required': 'Le mot de passe est requis'
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref('password')) // Référence croisée pour validation cohérence
    .required()
    .messages({
      'any.only': 'La confirmation du mot de passe ne correspond pas',
      'any.required': 'La confirmation du mot de passe est requise'
    }),

  firstName: Joi.string()
    .min(2) // Évite les noms trop courts non réalistes
    .max(50) // Limite raisonnable pour l'affichage UI
    .pattern(/^[A-Za-zÀ-ÿ\s\-']+$/) // Support des caractères internationaux et noms composés
    .trim()
    .required()
    .messages({
      'string.min': 'Le prénom doit contenir au moins 2 caractères',
      'string.max': 'Le prénom ne doit pas dépasser 50 caractères',
      'string.pattern.base': 'Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes',
      'any.required': 'Le prénom est requis'
    }),

  lastName: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[A-Za-zÀ-ÿ\s\-']+$/)
    .trim()
    .required()
    .messages({
      'string.min': 'Le nom de famille doit contenir au moins 2 caractères',
      'string.max': 'Le nom de famille ne doit pas dépasser 50 caractères',
      'string.pattern.base': 'Le nom de famille ne peut contenir que des lettres, espaces, tirets et apostrophes',
      'any.required': 'Le nom de famille est requis'
    }),

  userType: Joi.string()
    .valid('player')
    .required()
    .messages({
      'any.only': 'Le type d\'utilisateur doit être "player" pour ce formulaire d\'inscription',
      'any.required': 'Le type d\'utilisateur est requis'
    }),

  // ========================
  // 🏈 CHAMPS SPÉCIFIQUES AU PROFIL JOUEUR
  // Ces champs correspondent exactement aux attentes de createPlayerProfile
  // ========================
  
  gender: Joi.string()
    .valid('male', 'female')
    .required()
    .messages({
      'any.only': 'Le genre doit être "male" ou "female"',
      'any.required': 'La sélection du genre est requise pour la composition des équipes'
    }),

  // 🔧 CHAMP CRITIQUE AJOUTÉ : dateOfBirth
  // Était manquant dans le schéma original, causant sa suppression
  dateOfBirth: Joi.date()
    .max('now') // Empêche les dates futures
    .min('1990-01-01') // Limite raisonnable pour joueurs universitaires
    .required()
    .messages({
      'date.base': 'La date de naissance doit être une date valide',
      'date.max': 'La date de naissance ne peut pas être dans le futur',
      'date.min': 'La date de naissance semble trop ancienne pour un joueur universitaire',
      'any.required': 'La date de naissance est requise'
    }),

  // 🔧 CHAMP CRITIQUE AJOUTÉ : height
  // Validation adaptée aux standards américains (pouces)
  height: Joi.number()
    .integer()
    .min(60) // 5 pieds - limite inférieure réaliste
    .max(84) // 7 pieds - limite supérieure réaliste pour le football
    .required()
    .messages({
      'number.base': 'La taille doit être un nombre',
      'number.integer': 'La taille doit être un nombre entier de pouces',
      'number.min': 'La taille doit être d\'au moins 60 pouces (5 pieds)',
      'number.max': 'La taille ne peut pas dépasser 84 pouces (7 pieds)',
      'any.required': 'La taille est requise'
    }),

  // 🔧 CHAMP CRITIQUE AJOUTÉ : weight  
  // Validation adaptée aux standards américains (livres)
  weight: Joi.number()
    .integer()
    .min(100) // Limite inférieure sécuritaire
    .max(400) // Limite supérieure réaliste même pour les joueurs de ligne
    .required()
    .messages({
      'number.base': 'Le poids doit être un nombre',
      'number.integer': 'Le poids doit être un nombre entier de livres',
      'number.min': 'Le poids doit être d\'au moins 100 livres',
      'number.max': 'Le poids ne peut pas dépasser 400 livres',
      'any.required': 'Le poids est requis'
    }),

  // 🔧 CHAMP CRITIQUE AJOUTÉ : position
  // Liste complète des positions de football américain organisée par catégories
  position: Joi.string()
    .valid(
      // Positions Offensives
      'quarterback', 'running_back', 'fullback', 'wide_receiver', 'tight_end',
      'offensive_line', 'center', 'guard', 'tackle',
      
      // Positions Défensives  
      'defensive_end', 'defensive_tackle', 'nose_tackle', 'linebacker',
      'cornerback', 'safety', 'free_safety', 'strong_safety',
      
      // Équipes Spéciales
      'kicker', 'punter', 'long_snapper', 'return_specialist'
    )
    .required()
    .messages({
      'any.only': 'Veuillez sélectionner une position de jeu valide',
      'any.required': 'La position de jeu est requise'
    }),

  collegeId: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'La sélection du collège est requise',
      'number.integer': 'Sélection de collège invalide',
      'number.positive': 'Sélection de collège invalide',
      'any.required': 'Veuillez sélectionner votre collège NJCAA'
    })
    .external(async (value, helpers) => {
      // 🔍 Validation Existentielle : Vérification en base de données
      // Cette étape s'assure que le collège existe et accepte encore les inscriptions
      try {
        const college = await NJCAACollege.findByPk(value);
        
        if (!college) {
          throw new Error('Le collège sélectionné n\'existe pas dans notre base de données');
        }
        
        if (!college.isActive) {
          throw new Error('Le collège sélectionné n\'accepte plus les nouvelles inscriptions');
        }
        
        // Retour enrichi pour utilisation potentielle dans les étapes suivantes
        return { collegeId: value, collegeData: college };
        
      } catch (error) {
        throw new Error(`Erreur de validation du collège : ${error.message}`);
      }
    }),

  // 🔧 CHAMP CRITIQUE AJOUTÉ : currentYear
  // Limité aux années académiques réalistes pour les collèges communautaires
  currentYear: Joi.string()
    .valid('freshman', 'sophomore', 'redshirt')
    .required()
    .messages({
      'any.only': 'L\'année académique doit être freshman, sophomore, ou redshirt',
      'any.required': 'L\'année académique actuelle est requise'
    }),

  // 🔧 CHAMP CRITIQUE AJOUTÉ : graduationYear
  // Validation dynamique basée sur l'année actuelle
  graduationYear: Joi.number()
    .integer()
    .min(new Date().getFullYear()) // Pas de diplôme dans le passé
    .max(new Date().getFullYear() + 6) // Maximum raisonnable pour parcours universitaire
    .required()
    .messages({
      'number.base': 'L\'année de diplôme doit être un nombre',
      'number.integer': 'L\'année de diplôme doit être une année valide',
      'number.min': 'L\'année de diplôme ne peut pas être dans le passé',
      'number.max': 'L\'année de diplôme doit être dans les 6 prochaines années maximum',
      'any.required': 'L\'année de diplôme prévue est requise'
    }),

  // ========================
  // 📋 CHAMPS OPTIONNELS ET PRÉFÉRENCES
  // Ces champs enrichissent le profil mais ne bloquent pas l'inscription
  // ========================
  
  termsAccepted: Joi.boolean()
    .valid(true) // Doit être explicitement accepté
    .required()
    .messages({
      'any.only': 'Vous devez accepter les conditions d\'utilisation pour vous inscrire',
      'any.required': 'L\'acceptation des conditions est requise'
    }),

  newsletterOptIn: Joi.boolean()
    .default(false) // Valeur par défaut pour respecter RGPD/CCPA
    .messages({
      'boolean.base': 'La préférence newsletter doit être vraie ou fausse'
    }),

  // 🔧 CHAMP CORRIGÉ : referralSource  
  // Valeurs synchronisées avec les attentes du backend
  referralSource: Joi.string()
    .valid('social_media', 'coach_recommendation', 'college_counselor', 'friend', 'web_search', 'other')
    .optional() // Champ vraiment optionnel pour ne pas bloquer l'inscription
    .messages({
      'any.only': 'Veuillez sélectionner une source de recommandation valide'
    })

}).options({
  // 🎯 Options de Validation Critiques
  abortEarly: false, // Collecte TOUTES les erreurs pour un feedback complet à l'utilisateur
  stripUnknown: true, // Maintenant sûr car TOUS les champs requis sont définis
  presence: 'required' // Par défaut, tous les champs sont requis sauf indication contraire
});

/**
 * 🔄 Schéma de Validation pour la Mise à Jour du Profil Joueur
 * 
 * Ce schéma dérivé permet de modifier seulement certains champs du profil
 * sans obliger à re-valider l'ensemble des données d'inscription.
 * 
 * 🎓 Concept Pédagogique : Fork Pattern
 * Joi permet de créer des variantes d'un schéma de base, ici en rendant
 * tous les champs optionnels sauf ceux interdits en mise à jour.
 */
const playerUpdateSchema = playerRegistrationSchema.fork(
  // Rendre tous les champs optionnels pour les mises à jour partielles
  Object.keys(playerRegistrationSchema.describe().keys),
  schema => schema.optional()
).fork(
  // Interdire explicitement les champs qui ne doivent jamais être modifiés après inscription
  ['password', 'confirmPassword', 'userType', 'email'],
  schema => schema.forbidden()
);

/**
 * 🔍 Schéma de Validation pour les Critères de Recherche de Joueurs
 * 
 * Utilisé par les coachs pour filtrer et rechercher des joueurs selon
 * leurs critères de recrutement spécifiques.
 * 
 * 🎯 Design Pattern : Tous les critères sont optionnels car une recherche
 * sans filtre doit retourner tous les joueurs visibles.
 */
const playerSearchSchema = Joi.object({
  // Critères de jeu
  position: Joi.array().items(
    Joi.string().valid(
      'quarterback', 'running_back', 'fullback', 'wide_receiver', 'tight_end',
      'offensive_line', 'center', 'guard', 'tackle',
      'defensive_end', 'defensive_tackle', 'nose_tackle', 'linebacker',
      'cornerback', 'safety', 'free_safety', 'strong_safety',
      'kicker', 'punter', 'long_snapper', 'return_specialist'
    )
  ).optional(),

  // Critères physiques avec plages
  heightRange: Joi.object({
    min: Joi.number().min(60).max(84).optional(),
    max: Joi.number().min(60).max(84).optional()
  }).optional(),

  weightRange: Joi.object({
    min: Joi.number().min(100).max(400).optional(),
    max: Joi.number().min(100).max(400).optional()
  }).optional(),

  // Critères académiques et temporels
  graduationYear: Joi.array().items(
    Joi.number().integer().min(2024).max(2030)
  ).optional(),

  currentYear: Joi.array().items(
    Joi.string().valid('freshman', 'sophomore', 'redshirt')
  ).optional(),

  // Critères géographiques
  states: Joi.array().items(Joi.string().length(2)).optional(),
  regions: Joi.array().items(Joi.string()).optional(),

  // Critères de métadonnées
  gender: Joi.string().valid('male', 'female').optional(),
  isProfileVisible: Joi.boolean().default(true),

  // Pagination et tri pour performance
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('name', 'graduationYear', 'height', 'weight', 'lastActive').default('lastActive'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')

}).options({
  stripUnknown: true,
  abortEarly: false
});

/**
 * 📊 Export des Schémas avec Documentation
 * 
 * Ces schémas sont conçus pour être utilisés par différentes parties
 * de l'application selon les besoins spécifiques de validation.
 */
module.exports = {
  // Schéma principal pour l'inscription des joueurs
  playerRegistrationSchema,
  
  // Schéma pour les mises à jour de profil 
  playerUpdateSchema,
  
  // Schéma pour les recherches de joueurs par les coachs
  playerSearchSchema,
  
  // 🎓 Fonction utilitaire pour extraire les messages d'erreur formatés
  extractValidationErrors: (joiError) => {
    return joiError.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
      context: detail.context
    }));
  },
  
  // 🔍 Fonction utilitaire pour valider uniquement certains champs
  validatePartialPlayerData: (data, fields) => {
    const partialSchema = playerRegistrationSchema.fork(
      fields,
      schema => schema.required()
    ).fork(
      Object.keys(playerRegistrationSchema.describe().keys).filter(key => !fields.includes(key)),
      schema => schema.optional()
    );
    
    return partialSchema.validate(data);
  }
};