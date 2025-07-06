// portall/server/controllers/authController.js

const { User, PlayerProfile, CoachProfile, NJCAACoachProfile } = require('../models');
const AuthService = require('../services/authService');
const emailService = require('../services/emailService');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database.connection');

/**
 * 🔐 Contrôleur d'authentification COMPLET mis à jour pour tous les types d'utilisateurs
 * 
 * Ce contrôleur gère l'authentification pour TROIS types d'utilisateurs :
 * 1. 👤 Joueurs NJCAA (players) - Profil PlayerProfile
 * 2. 🏟️ Coachs NCAA/NAIA (coaches) - Profil CoachProfile  
 * 3. 🏟️ Coachs NJCAA (njcaa_coaches) - Profil NJCAACoachProfile [NOUVEAU]
 * 
 * 🎯 Fonctionnalités principales :
 * - Inscription avec validation conditionnelle selon le type
 * - Connexion universelle pour tous les types
 * - Gestion des tokens JWT avec refresh
 * - Reset de mot de passe avec emails automatiques
 * - Récupération de profils complets avec relations
 * 
 * 🏗️ Architecture pédagogique : Ce contrôleur montre comment étendre une
 * architecture existante pour supporter de nouveaux types d'utilisateurs
 * sans casser le code existant (principe Open/Closed de SOLID).
 */
class AuthController {
  /**
   * 📝 Inscription universelle avec routage intelligent selon le type d'utilisateur
   * 
   * Cette méthode centralisée gère l'inscription pour tous les types d'utilisateurs.
   * Elle suit un pattern de Factory Method pour créer le bon type de profil
   * selon le userType fourni.
   * 
   * 🔄 Workflow d'inscription :
   * 1. Validation des données (déjà fait par middleware)
   * 2. Vérification que l'email n'existe pas
   * 3. Validation spécialisée selon le type (business logic)
   * 4. Création de l'utilisateur de base
   * 5. Création du profil spécialisé (Player/Coach/NJCAACoach)
   * 6. Envoi des emails de notification
   * 
   * 💡 Concept clé : Transaction atomique - soit tout réussit, soit tout échoue
   */
  static async register(req, res) {
    // Transaction atomique pour assurer la cohérence des données
    const transaction = await sequelize.transaction();

    try {
      const { email, password, firstName, lastName, userType, ...profileData } = req.body;

      console.log(`🚀 Starting registration process for: ${email} (${userType})`);

      // ========================
      // ÉTAPE 1 : VÉRIFICATIONS PRÉLIMINAIRES
      // ========================
      
      // Vérifier que l'email n'est pas déjà utilisé
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        await transaction.rollback();
        return res.status(409).json({
          status: 'error',
          message: 'An account with this email already exists',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }

      // ========================
      // ÉTAPE 2 : VALIDATION MÉTIER SPÉCIALISÉE
      // ========================
      
      // Validation des données de profil selon le type d'utilisateur
      const profileValidation = await AuthController.validateProfileData(userType, profileData);
      if (!profileValidation.isValid) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Profile validation failed',
          errors: profileValidation.errors
        });
      }

      // ========================
      // ÉTAPE 3 : CRÉATION DE L'UTILISATEUR DE BASE
      // ========================
      
      // Créer l'utilisateur de base avec token de vérification
      const emailVerificationToken = AuthService.generateSecureToken();
      
      const newUser = await User.create({
        email,
        password, // Sera hashé automatiquement par le hook beforeCreate
        firstName,
        lastName,
        userType,
        emailVerificationToken,
        isActive: false, // Toujours inactif en attendant validation admin
        isEmailVerified: false
      }, { transaction });

      console.log(`✅ Base user created: ${newUser.email} (ID: ${newUser.id}, Type: ${userType})`);

      // ========================
      // ÉTAPE 4 : CRÉATION DU PROFIL SPÉCIALISÉ
      // ========================
      
      // Créer le profil spécialisé selon le type d'utilisateur
      let profile = null;
      if (userType === 'player') {
        profile = await AuthController.createPlayerProfile(newUser.id, profileData, transaction);
      } else if (userType === 'coach') {
        profile = await AuthController.createCoachProfile(newUser.id, profileData, transaction);
      } else if (userType === 'njcaa_coach') {
        // 🆕 NOUVEAU : Création du profil coach NJCAA
        profile = await AuthController.createNJCAACoachProfile(newUser.id, profileData, transaction);
      }

      // ========================
      // ÉTAPE 5 : FINALISER LA TRANSACTION
      // ========================
      
      // Confirmer toutes les opérations en base de données
      await transaction.commit();

      console.log(`🎉 Complete registration successful for: ${newUser.email} (${userType})`);

      // ========================
      // ÉTAPE 6 : NOTIFICATIONS EMAIL ASYNCHRONES
      // ========================
      
      // IMPORTANT : Ces emails sont envoyés de manière asynchrone pour ne pas
      // ralentir la réponse au client. Si un email échoue, cela n'affecte pas
      // la création du compte qui a déjà été confirmée en base.

      // 1. Email de confirmation à l'utilisateur
      setTimeout(async () => {
        try {
          await emailService.sendRegistrationConfirmationEmail(newUser);
          console.log(`📧 Registration confirmation email sent to: ${newUser.email}`);
        } catch (emailError) {
          console.error('❌ Failed to send registration confirmation email:', emailError);
        }
      }, 100);

      // 2. Notification aux administrateurs
      setTimeout(async () => {
        try {
          await AuthController.notifyAdminsOfNewRegistration(newUser);
        } catch (notificationError) {
          console.error('❌ Failed to notify admins:', notificationError);
        }
      }, 200);

      // ========================
      // ÉTAPE 7 : RÉPONSE CLIENT
      // ========================
      
      return res.status(201).json({
        status: 'success',
        message: AuthController.getRegistrationSuccessMessage(userType),
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            userType: newUser.userType
          },
          profile: profile?.toJSON ? profile.toJSON() : profile,
          nextSteps: {
            emailVerification: false, // Géré par validation admin
            adminApproval: true,
            estimatedApprovalTime: userType === 'njcaa_coach' ? '24-48 hours' : '48-72 hours'
          }
        }
      });

    } catch (error) {
      // Rollback en cas d'erreur
      await transaction.rollback();
      
      console.error('Registration error:', error);

      // Gestion d'erreur spécialisée selon le type d'erreur
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          status: 'error',
          message: 'Validation error during registration',
          errors: error.errors.map(err => ({
            field: err.path,
            message: err.message
          }))
        });
      }
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          status: 'error',
          message: 'This email is already registered',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }
      
      return res.status(500).json({
        status: 'error',
        message: 'Registration failed due to server error',
        code: 'REGISTRATION_ERROR'
      });
    }
  }

  /**
   * 👤 Création du profil joueur (méthode existante inchangée)
   * 
   * Cette méthode crée un profil spécialisé pour les joueurs NJCAA
   * avec toutes leurs données sportives et académiques.
   */
  static async createPlayerProfile(userId, profileData, transaction) {
    try {
      console.log(`👤 Creating player profile for user ${userId}`);
      
      const {
        dateOfBirth, height, weight, position, jerseyNumber, gender,
        collegeId, currentYear, graduationYear, major, gpa, transferStatus,
        playingExperience, achievements, bio, instagramHandle, highlights
      } = profileData;

      // Gérer les données de college enrichies (depuis la validation Joi externe)
      let actualCollegeId;
      if (typeof collegeId === 'object' && collegeId.collegeId) {
        actualCollegeId = collegeId.collegeId;
      } else {
        actualCollegeId = parseInt(collegeId, 10);
      }

      const playerProfile = await PlayerProfile.create({
        userId: userId,
        dateOfBirth: new Date(dateOfBirth),
        height: parseInt(height, 10),
        weight: parseInt(weight, 10),
        position: position,
        jerseyNumber: jerseyNumber ? parseInt(jerseyNumber, 10) : null,
        gender: gender,
        collegeId: actualCollegeId,
        currentYear: currentYear,
        graduationYear: parseInt(graduationYear, 10),
        major: major || null,
        gpa: gpa ? parseFloat(gpa) : null,
        transferStatus: transferStatus || 'not_transferring',
        playingExperience: playingExperience || null,
        achievements: achievements || null,
        bio: bio || null,
        instagramHandle: instagramHandle || null,
        highlights: highlights || null,
        isProfileVisible: false, // Invisible jusqu'à validation admin
        profileViews: 0
      }, { transaction });

      console.log(`✅ Player profile created successfully (ID: ${playerProfile.id})`);
      
      return playerProfile;
      
    } catch (error) {
      console.error('Error creating player profile:', error);
      throw new Error(`Player profile creation failed: ${error.message}`);
    }
  }

  /**
   * 🏟️ Création du profil coach NCAA/NAIA (méthode existante inchangée)
   * 
   * Cette méthode crée un profil spécialisé pour les coachs NCAA/NAIA
   * qui recherchent des joueurs et paient des abonnements.
   */
  static async createCoachProfile(userId, profileData, transaction) {
    try {
      console.log(`🏟️ Creating coach profile for user ${userId}`);
      
      const { position, phoneNumber, collegeId, division, teamSport } = profileData;

      // Extraction intelligente de l'ID numérique du college NCAA
      let actualCollegeId;
      if (typeof collegeId === 'object' && collegeId.collegeId) {
        // Cas où les données sont enrichies par la validation Joi externe
        actualCollegeId = collegeId.collegeId;
        console.log('✅ [createCoachProfile] Using enriched college ID:', actualCollegeId);
      } else if (typeof collegeId === 'number' || typeof collegeId === 'string') {
        // Cas où nous avons un ID simple
        actualCollegeId = parseInt(collegeId, 10);
        console.log('✅ [createCoachProfile] Using simple college ID:', actualCollegeId);
      } else {
        console.error('❌ [createCoachProfile] Invalid college ID format:', collegeId);
        throw new Error('Invalid college ID format for coach profile creation');
      }

      const coachProfile = await CoachProfile.create({
        userId: userId,
        position: position,
        phoneNumber: phoneNumber,
        collegeId: actualCollegeId,
        division: division,
        teamSport: teamSport,
        savedSearches: [], // Initialisé vide, sera rempli par l'usage
        totalSearches: 0
      }, { transaction });

      console.log(`✅ Coach profile created successfully (ID: ${coachProfile.id})`);
      return coachProfile;
      
    } catch (error) {
      console.error('Error creating coach profile:', error);
      throw new Error(`Coach profile creation failed: ${error.message}`);
    }
  }

  /**
   * 🏟️ 🆕 NOUVELLE MÉTHODE : Création du profil coach NJCAA
   * 
   * Cette méthode crée un profil spécialisé pour les coachs NJCAA
   * avec leurs données métier spécifiques. Les coachs NJCAA ont un
   * workflow différent : ils évaluent leurs joueurs plutôt que de
   * rechercher et payer des abonnements.
   * 
   * 🔍 Différences avec les coachs NCAA/NAIA :
   * - Utilisent les colleges NJCAA (pas NCAA)
   * - Divisions NJCAA spécifiques (D1, D2, D3)
   * - Pas d'abonnement Stripe
   * - Métriques d'évaluation au lieu de recherches
   */
  static async createNJCAACoachProfile(userId, profileData, transaction) {
    try {
      console.log(`🏟️ Creating NJCAA coach profile for user ${userId}`);
      
      const { position, phoneNumber, collegeId, division, teamSport } = profileData;
      
      // Gérer les données de college enrichies (depuis la validation Joi externe)
      let actualCollegeId;
      if (typeof collegeId === 'object' && collegeId.collegeId) {
        actualCollegeId = collegeId.collegeId;
        console.log('✅ [createNJCAACoachProfile] Using enriched college ID:', actualCollegeId);
      } else {
        actualCollegeId = parseInt(collegeId, 10);
        console.log('✅ [createNJCAACoachProfile] Using simple college ID:', actualCollegeId);
      }
      
      const njcaaCoachProfile = await NJCAACoachProfile.create({
        userId: userId,
        position: position,
        phoneNumber: phoneNumber,
        collegeId: actualCollegeId,
        division: division,
        teamSport: teamSport,
        totalEvaluations: 0, // Commencer à zéro
        lastEvaluationDate: null
      }, { transaction });

      console.log(`✅ NJCAA coach profile created successfully (ID: ${njcaaCoachProfile.id})`);
      
      return njcaaCoachProfile;
      
    } catch (error) {
      console.error('Error creating NJCAA coach profile:', error);
      throw new Error(`NJCAA coach profile creation failed: ${error.message}`);
    }
  }

  /**
   * 🔐 Connexion universelle pour tous les types d'utilisateurs
   * 
   * Cette méthode gère la connexion pour les 3 types d'utilisateurs.
   * Elle récupère automatiquement le bon profil selon le type et
   * génère les tokens d'authentification.
   * 
   * 🎯 Améliorations par rapport à la version précédente :
   * - Support du nouveau type njcaa_coach
   * - Récupération automatique du profil complet
   * - Gestion des utilisateurs inactifs
   * - Mise à jour de la dernière connexion
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      console.log(`🔐 Login attempt for: ${email}`);

      // Rechercher l'utilisateur par email
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Vérifier le mot de passe
      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        console.log(`❌ Invalid password for user: ${email}`);
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Vérifier que le compte est actif
      if (!user.isActive) {
        return res.status(403).json({
          status: 'error',
          message: 'Account is not activated. Please wait for admin approval.',
          code: 'ACCOUNT_NOT_ACTIVE'
        });
      }

      // Générer les tokens d'authentification
      const tokenPair = AuthService.generateTokenPair(user);
      
      // Mettre à jour la dernière connexion
      await user.updateLastLogin();

      console.log(`✅ Login successful for user: ${email} (${user.userType})`);

      // 🔄 AMÉLIORATION : Récupérer le profil complet pour le frontend
      const userWithProfile = await user.toCompleteJSON();

      return res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: userWithProfile,
          tokens: tokenPair
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Login failed. Please try again later.',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 🔄 Rafraîchissement des tokens (méthode existante inchangée)
   * 
   * Cette méthode permet de renouveler les tokens d'accès sans
   * redemander à l'utilisateur de se reconnecter. Elle vérifie
   * la validité du refresh token et génère une nouvelle paire.
   */
  static async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      console.log('🔄 Token refresh attempt');

      // Vérifier et décoder le refresh token
      let decoded;
      try {
        decoded = AuthService.verifyToken(refreshToken);
      } catch (error) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }

      // S'assurer que c'est bien un refresh token
      if (decoded.tokenType !== 'refresh') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token type',
          code: 'INVALID_TOKEN_TYPE'
        });
      }

      // Vérifier que l'utilisateur existe toujours et est actif
      const user = await User.findByPk(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'User not found or inactive',
          code: 'USER_NOT_FOUND'
        });
      }

      // Générer une nouvelle paire de tokens
      const newTokenPair = AuthService.generateTokenPair(user);

      console.log(`✅ Token refreshed for user: ${user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Tokens refreshed successfully',
        data: {
          tokens: newTokenPair
        }
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Token refresh failed',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 🚪 Déconnexion (méthode existante inchangée)
   * 
   * Avec JWT, la déconnexion côté serveur est principalement
   * symbolique puisque les tokens sont stateless. La vraie
   * déconnexion se fait côté client en supprimant les tokens.
   */
  static async logout(req, res) {
    try {
      const user = req.user;

      console.log(`🚪 Logout for user: ${user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Logout successful',
        instructions: 'Please remove tokens from client storage'
      });

    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Logout failed',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 👤 Obtenir le profil de l'utilisateur connecté (méthode améliorée)
   * 
   * Cette méthode récupère maintenant le profil complet avec
   * toutes les relations pour fournir toutes les données
   * nécessaires au frontend selon le type d'utilisateur.
   * 
   * 🔄 Amélioration : Support automatique des 3 types d'utilisateurs
   */
  static async getMe(req, res) {
    try {
      const user = req.user;

      // Récupérer l'utilisateur frais depuis la base avec ses relations
      const freshUser = await User.findByPk(user.id);
      
      if (!freshUser) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Récupérer le profil complet avec les relations
      const userWithProfile = await freshUser.toCompleteJSON();

      return res.status(200).json({
        status: 'success',
        data: {
          user: userWithProfile
        }
      });

    } catch (error) {
      console.error('Get user profile error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to get user profile',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 🔑 Demande de reset de mot de passe avec email automatique
   * 
   * Cette méthode génère un token de reset sécurisé et envoie
   * automatiquement l'email avec le lien de réinitialisation.
   * Elle fonctionne pour tous les types d'utilisateurs.
   */
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      console.log(`🔑 Password reset request for: ${email}`);

      const user = await User.findByEmail(email);
      
      // Réponse standardisée pour la sécurité (ne révèle pas si l'email existe)
      const standardResponse = {
        status: 'success',
        message: 'If an account with this email exists, password reset instructions have been sent.'
      };

      if (!user) {
        // Même réponse pour éviter l'énumération d'emails
        return res.status(200).json(standardResponse);
      }

      // Générer un token de reset sécurisé avec expiration
      const resetToken = AuthService.generateSecureToken();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

      // Sauvegarder le token en base
      await user.update({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      });

      // Envoyer l'email de reset de manière asynchrone
      setTimeout(async () => {
        try {
          await emailService.sendPasswordResetEmail(user, resetToken);
          console.log(`📧 Password reset email sent to: ${user.email}`);
        } catch (emailError) {
          console.error('❌ Failed to send password reset email:', emailError);
        }
      }, 100);

      return res.status(200).json(standardResponse);

    } catch (error) {
      console.error('Forgot password error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Password reset request failed. Please try again later.',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 🔑 Réinitialisation du mot de passe avec token (méthode existante inchangée)
   * 
   * Cette méthode vérifie le token de reset et met à jour le mot de passe.
   * Elle fonctionne pour tous les types d'utilisateurs.
   */
  static async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      console.log('🔑 Password reset attempt with token');

      // Rechercher l'utilisateur avec un token valide et non expiré
      const user = await User.findOne({
        where: {
          passwordResetToken: token,
          passwordResetExpires: {
            [Op.gt]: new Date() // Token non expiré
          }
        }
      });

      if (!user) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid or expired reset token',
          code: 'INVALID_RESET_TOKEN'
        });
      }

      // Mettre à jour le mot de passe et nettoyer les tokens de reset
      await user.update({
        password: password, // Sera hashé automatiquement par le hook
        passwordResetToken: null,
        passwordResetExpires: null
      });

      console.log(`✅ Password reset successful for user: ${user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Password reset successful. You can now login with your new password.'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Password reset failed',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  // ========================
  // 🛠️ MÉTHODES UTILITAIRES ET VALIDATIONS
  // ========================

  /**
   * 🆕 Message de succès d'inscription adapté au type d'utilisateur
   * 
   * Cette méthode retourne un message personnalisé selon le type
   * d'utilisateur pour améliorer l'expérience utilisateur.
   */
  static getRegistrationSuccessMessage(userType) {
    const messages = {
      player: 'Player account created successfully! Your account is pending admin approval.',
      coach: 'Coach account created successfully! Your account is pending admin approval.',
      njcaa_coach: 'NJCAA Coach account created successfully! Your account is pending admin approval and you will receive access to your player evaluation dashboard once approved.'
    };
    
    return messages[userType] || 'Account created successfully! Your account is pending admin approval.';
  }

  /**
   * 📧 Notification automatique des admins pour nouvelles inscriptions
   * 
   * Cette méthode récupère tous les administrateurs actifs et leur envoie
   * une notification de nouvelle inscription nécessitant leur attention.
   * 
   * 🎯 Pattern utilisé : Service discovery pattern - on trouve dynamiquement
   * tous les admins plutôt que d'avoir une liste codée en dur.
   */
  static async notifyAdminsOfNewRegistration(newUser) {
    try {
      // Récupérer tous les emails des admins actifs
      const adminUsers = await User.findAll({
        where: {
          userType: 'admin',
          isActive: true
        },
        attributes: ['email', 'firstName', 'lastName']
      });

      if (adminUsers.length === 0) {
        console.warn('⚠️ No active admin users found for notification');
        return;
      }

      const adminEmails = adminUsers.map(admin => admin.email);
      
      console.log(`📧 Notifying ${adminEmails.length} admins of new ${newUser.userType} registration`);
      
      // Envoyer la notification à tous les admins simultanément
      const results = await emailService.sendNewRegistrationNotificationToAdmin(newUser, adminEmails);
      
      // Vérifier les résultats d'envoi
      const successfulSends = results.filter(result => result.success).length;
      const failedSends = results.length - successfulSends;
      
      if (failedSends > 0) {
        console.warn(`⚠️ ${failedSends} admin notifications failed to send`);
      }
      
      console.log(`📧 Successfully notified ${successfulSends}/${adminEmails.length} admins`);
      return results;

    } catch (error) {
      console.error('❌ Error notifying admins of new registration:', error);
      // On ne lance pas l'erreur car ce n'est pas critique pour l'inscription
      // L'admin peut toujours voir les nouveaux comptes dans son dashboard
    }
  }

  /**
   * 🔍 Validation des données de profil selon le type d'utilisateur
   * 
   * Cette méthode encapsule toute la logique de validation métier
   * spécifique à chaque type d'utilisateur. Elle vérifie non seulement
   * le format des données, mais aussi leur cohérence business.
   * 
   * 🎯 Exemples de validations métier :
   * - Vérifier que le college existe et est actif
   * - Valider la cohérence division/college
   * - Vérifier les contraintes d'âge pour les joueurs
   * - Valider les numéros de téléphone professionnels pour les coachs
   */
  static async validateProfileData(userType, profileData) {
    const errors = [];
    
    try {
      // Import des modèles au moment de l'exécution pour éviter les dépendances circulaires
      const models = require('../models');

      if (userType === 'player') {
        // Validation spécifique aux joueurs
        const { 
          dateOfBirth, height, weight, position, gender, 
          collegeId, currentYear, graduationYear, gpa 
        } = profileData;

        // Validation âge (16-25 ans typiquement pour NJCAA)
        if (dateOfBirth) {
          const age = new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
          if (age < 16 || age > 30) {
            errors.push({
              field: 'dateOfBirth',
              message: 'Age must be between 16 and 30 years for NJCAA players'
            });
          }
        }

        // Validation dimensions physiques réalistes
        if (height && (height < 150 || height > 220)) {
          errors.push({
            field: 'height',
            message: 'Height must be between 150 and 220 cm'
          });
        }

        if (weight && (weight < 50 || weight > 150)) {
          errors.push({
            field: 'weight',
            message: 'Weight must be between 50 and 150 kg'
          });
        }

        // Validation college NJCAA
        if (collegeId) {
          try {
            const college = await models.NJCAACollege.findByPk(collegeId);
            if (!college || !college.isActive) {
              errors.push({
                field: 'collegeId',
                message: 'Invalid or inactive NJCAA college'
              });
            }
          } catch (dbError) {
            errors.push({
              field: 'collegeId',
              message: 'Error validating college'
            });
          }
        }

        // Validation GPA
        if (gpa && (gpa < 0 || gpa > 4.0)) {
          errors.push({
            field: 'gpa',
            message: 'GPA must be between 0.0 and 4.0'
          });
        }

      } else if (userType === 'coach') {
        // Validation spécifique aux coachs NCAA/NAIA
        const { position, phoneNumber, collegeId, division, teamSport } = profileData;

        if (!position || !['head_coach', 'assistant_coach'].includes(position)) {
          errors.push({
            field: 'position',
            message: 'Position is required and must be head_coach or assistant_coach'
          });
        }

        if (!phoneNumber || !/^\+?[\d\s\-\(\)]+$/.test(phoneNumber)) {
          errors.push({
            field: 'phoneNumber',
            message: 'Valid phone number is required for recruiting contact'
          });
        }

        if (!division || !['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia'].includes(division)) {
          errors.push({
            field: 'division',
            message: 'Valid division is required (NCAA D1/D2/D3 or NAIA)'
          });
        }

        if (!teamSport || !['mens_soccer', 'womens_soccer'].includes(teamSport)) {
          errors.push({
            field: 'teamSport',
            message: 'Team sport selection is required (mens_soccer or womens_soccer)'
          });
        }

        // Validation college NCAA (simplifiée pour l'instant)
        if (collegeId) {
          try {
            let actualCollegeId = collegeId;
            if (typeof collegeId === 'object' && collegeId.collegeId) {
              actualCollegeId = collegeId.collegeId;
            }
            
            const college = await models.NCAACollege.findByPk(actualCollegeId);
            if (!college || !college.isActive) {
              errors.push({
                field: 'collegeId',
                message: 'Invalid or inactive NCAA college'
              });
            }
          } catch (dbError) {
            errors.push({
              field: 'collegeId',
              message: 'Error validating NCAA college'
            });
          }
        }

      } else if (userType === 'njcaa_coach') {
        // 🆕 NOUVELLE VALIDATION : Pour les coachs NJCAA
        const { position, phoneNumber, collegeId, division, teamSport } = profileData;

        // Validation position (identique aux autres coachs)
        if (!position || !['head_coach', 'assistant_coach'].includes(position)) {
          errors.push({
            field: 'position',
            message: 'Position must be head_coach or assistant_coach'
          });
        }

        // Validation téléphone (identique aux autres coachs)
        if (!phoneNumber || phoneNumber.length < 10) {
          errors.push({
            field: 'phoneNumber',
            message: 'Valid phone number is required'
          });
        }

        // 🎯 Validation division NJCAA spécifique
        if (!division || !['njcaa_d1', 'njcaa_d2', 'njcaa_d3'].includes(division)) {
          errors.push({
            field: 'division',
            message: 'Valid NJCAA division is required (D1, D2, or D3)'
          });
        }

        // Validation sport (identique aux autres coachs)
        if (!teamSport || !['mens_soccer', 'womens_soccer'].includes(teamSport)) {
          errors.push({
            field: 'teamSport',
            message: 'Team sport selection is required (mens_soccer or womens_soccer)'
          });
        }

        // 🏫 Validation college NJCAA spécifique
        if (collegeId) {
          try {
            let actualCollegeId = collegeId;
            if (typeof collegeId === 'object' && collegeId.collegeId) {
              actualCollegeId = collegeId.collegeId;
            }
            
            const college = await models.NJCAACollege.findByPk(actualCollegeId);
            if (!college || !college.isActive) {
              errors.push({
                field: 'collegeId',
                message: 'Invalid or inactive NJCAA college'
              });
            }

            // 🔍 Validation croisée : la division du coach doit correspondre au college
            // Cette validation peut être ajoutée plus tard si nécessaire
            // if (college.division !== division) {
            //   errors.push({
            //     field: 'division',
            //     message: `Division mismatch: ${college.name} is ${college.division} but you selected ${division}`
            //   });
            // }

          } catch (dbError) {
            errors.push({
              field: 'collegeId',
              message: 'Error validating NJCAA college'
            });
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors: errors
      };

    } catch (error) {
      console.error('Profile validation error:', error);
      return {
        isValid: false,
        errors: [{
          field: 'general',
          message: 'Profile validation failed due to server error'
        }]
      };
    }
  }
}

module.exports = AuthController;