// portall/server/controllers/authController.js

const { User, PlayerProfile, CoachProfile, NJCAACoachProfile, NJCAACollege, NCAACollege } = require('../models');
const AuthService = require('../services/authService');
const emailService = require('../services/emailService');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database.connection');

// ✅ CORRECTION CRITIQUE : Import de bcrypt manquant
const bcrypt = require('bcryptjs');

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
    const transaction = await sequelize.transaction();
    
    try {
      console.log(`📝 Registration attempt for user type: ${req.body.userType}`);
      
      const { 
        email, 
        password, 
        confirmPassword,
        firstName, 
        lastName, 
        userType,
        // Champs spécifiques selon le type d'utilisateur
        ...additionalData
      } = req.body;

      // ✅ Validation de base commune à tous les types
      if (!email || !password || !firstName || !lastName || !userType) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      if (password !== confirmPassword) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Passwords do not match',
          code: 'PASSWORD_MISMATCH'
        });
      }

      // Vérifier que l'email n'existe pas déjà
      const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
      if (existingUser) {
        await transaction.rollback();
        return res.status(409).json({
          status: 'error',
          message: 'Email already registered',
          code: 'EMAIL_EXISTS'
        });
      }

      // ✅ ÉTAPE 1 : Créer l'utilisateur de base
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const user = await User.create({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        userType: userType,
        isActive: false, // Désactivé jusqu'à validation admin
        isEmailVerified: false
      }, { transaction });

      console.log(`✅ Base user created (ID: ${user.id})`);

      // ✅ ÉTAPE 2 : Créer le profil spécialisé selon le type
      let profile = null;
      
      switch (userType) {
        case 'player':
          profile = await AuthController.createPlayerProfile(user.id, additionalData, transaction);
          break;
          
        case 'coach':
          profile = await AuthController.createCoachProfile(user.id, additionalData, transaction);
          break;
          
        case 'njcaa_coach':
          profile = await AuthController.createNJCAACoachProfile(user.id, additionalData, transaction);
          break;
          
        default:
          await transaction.rollback();
          return res.status(400).json({
            status: 'error',
            message: 'Invalid user type',
            code: 'INVALID_USER_TYPE'
          });
      }

      // ✅ ÉTAPE 3 : Finaliser l'inscription
      await transaction.commit();
      
      console.log(`🎉 Registration completed successfully for ${userType}: ${email}`);

      // Générer les tokens pour la connexion automatique (optionnel)
      const tokens = AuthService.generateTokenPair(user);

      return res.status(201).json({
        status: 'success',
        message: 'Registration successful',
        data: {
          user: user.toPublicJSON(),
          profile: profile ? profile.toJSON() : null,
          tokens: tokens
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Registration error:', error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Registration failed',
        code: 'REGISTRATION_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * 👤 Création du profil joueur avec conversion d'unités (VERSION CORRIGÉE)
   * 
   * Cette version ajoute la conversion automatique des unités impériales (interface)
   * vers les unités métriques (base de données) pour assurer la cohérence des validations.
   * 
   * 🎯 Conversions appliquées :
   * - Height : Pouces → Centimètres (× 2.54)
   * - Weight : Livres → Kilogrammes (÷ 2.205)
   */
  static async createPlayerProfile(userId, profileData, transaction) {
    try {
      console.log(`👤 Creating player profile for user ${userId}`);
    
      const { 
        dateOfBirth, 
        height, 
        weight, 
        position, 
        gender, 
        collegeId, 
        currentYear, 
        graduationYear 
      } = profileData;

      // Validation des champs requis
      if (!dateOfBirth || !height || !weight || !position || !gender || !collegeId || !currentYear || !graduationYear) {
        throw new Error('Missing required player fields');
      }

      // 🔧 CONVERSION D'UNITÉS IMPÉRIALES → MÉTRIQUES
      // Cette conversion assure la cohérence avec les validations Sequelize
      const heightInCm = Math.round(height * 2.54);        // Pouces → Centimètres  
      const weightInKg = Math.round(weight / 2.205);       // Livres → Kilogrammes
    
      console.log(`📏 Unit conversion - Height: ${height}" → ${heightInCm}cm, Weight: ${weight}lbs → ${weightInKg}kg`);

      // Vérifier que le college NJCAA existe
      const college = await NJCAACollege.findByPk(collegeId);
      if (!college || !college.isActive) {
        throw new Error('Invalid or inactive NJCAA college');
      }

      // Créer le profil avec les valeurs converties
      const playerProfile = await PlayerProfile.create({
        userId: userId,
        dateOfBirth: new Date(dateOfBirth),
        height: heightInCm,              // ✅ Valeur convertie en cm
        weight: weightInKg,              // ✅ Valeur convertie en kg
        position: position,
        gender: gender,
        collegeId: collegeId,
        currentYear: currentYear,
        graduationYear: parseInt(graduationYear),
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
   * 🏈 Création du profil coach NCAA/NAIA (méthode existante)
   */
  static async createCoachProfile(userId, profileData, transaction) {
    try {
      console.log(`🏈 Creating coach profile for user ${userId}`);
      
      const { 
        position, 
        phoneNumber, 
        collegeId, 
        schoolType, 
        yearsOfExperience,
        coachingLicenses 
      } = profileData;

      // Validation des champs requis
      if (!position || !phoneNumber || !collegeId || !schoolType) {
        throw new Error('Missing required coach fields');
      }

      // Vérifier que le college NCAA existe
      const college = await NCAACollege.findByPk(collegeId);
      if (!college || !college.isActive) {
        throw new Error('Invalid or inactive NCAA college');
      }

      const coachProfile = await CoachProfile.create({
        userId: userId,
        position: position,
        phoneNumber: phoneNumber,
        collegeId: collegeId,
        schoolType: schoolType,
        yearsOfExperience: yearsOfExperience || 0,
        coachingLicenses: coachingLicenses || [],
        isActive: false, // Nécessite validation et abonnement
        subscriptionStatus: 'none',
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
   * 🏟️ Création du profil coach NJCAA (NOUVELLE MÉTHODE)
   * 
   * CONCEPT MÉTIER : Les coachs NJCAA ont un workflow différent des autres :
   * - Pas d'abonnement Stripe requis
   * - Validation automatique par leur institution
   * - Accès immédiat aux fonctionnalités d'évaluation
   */
  static async createNJCAACoachProfile(userId, profileData, transaction) {
    try {
      console.log(`🏟️ Creating NJCAA coach profile for user ${userId}`);
      
      const { position, phoneNumber, collegeId, division, teamSport } = profileData;
      
      // Validation des champs requis pour NJCAA coach
      if (!position || !phoneNumber || !collegeId || !division || !teamSport) {
        throw new Error('Missing required NJCAA coach fields: position, phoneNumber, collegeId, division, teamSport');
      }

      // Vérifier que le college NJCAA existe
      const college = await NJCAACollege.findByPk(collegeId);
      if (!college || !college.isActive) {
        throw new Error('Invalid or inactive NJCAA college');
      }

      // Créer le profil coach NJCAA
      const njcaaCoachProfile = await NJCAACoachProfile.create({
        userId: userId,
        position: position,
        phoneNumber: phoneNumber,
        collegeId: collegeId,
        division: division,
        teamSport: teamSport,
        totalEvaluations: 0,
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
   * 🔐 Connexion universelle - MÉTHODE PRINCIPALE CORRIGÉE
   * 
   * Cette méthode gère la connexion pour tous les types d'utilisateurs avec
   * une approche défensive contre les erreurs et une gestion robuste des profils.
   */
  static async login(req, res) {
    try {
      console.log('🔍 Login attempt started');
      const { email, password } = req.body;

      // Validation des entrées de base
      if (!email || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Email and password are required',
          code: 'MISSING_CREDENTIALS'
        });
      }

      console.log(`🔍 Looking for user with email: ${email}`);

      // ✅ CORRECTION : Recherche simplifiée sans inclusion des profils
      // pour éviter les erreurs d'association lors de la connexion
      const user = await User.findOne({
        where: { email: email.toLowerCase().trim() }
      });

      if (!user) {
        console.log('❌ User not found');
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      console.log(`✅ User found: ${user.id} (${user.userType})`);

      // Vérifier le mot de passe avec la méthode intégrée
      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        console.log('❌ Invalid password');
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      console.log('✅ Password validated');

      // Vérifier que le compte est actif
      if (!user.isActive) {
        console.log('❌ Account inactive');
        return res.status(403).json({
          status: 'error',
          message: 'Account is not activated. Please contact support.',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      console.log('✅ Account is active');

      // ✅ CORRECTION : Récupération défensive du profil
      let profile = null;
      try {
        profile = await user.getProfile();
        console.log(`✅ Profile retrieved: ${profile ? 'Found' : 'Not found'}`);
      } catch (profileError) {
        console.error('⚠️ Profile retrieval error (non-critical):', profileError.message);
        // Ne pas faire échouer la connexion si le profil n'est pas trouvé
      }

      // Mettre à jour la dernière connexion
      try {
        await user.updateLastLogin();
        console.log('✅ Last login updated');
      } catch (updateError) {
        console.error('⚠️ Last login update error (non-critical):', updateError.message);
      }

      // ✅ CORRECTION : Génération sécurisée des tokens
      let tokens;
      try {
        tokens = AuthService.generateTokenPair(user);
        console.log('✅ Tokens generated successfully');
      } catch (tokenError) {
        console.error('❌ Token generation error:', tokenError);
        return res.status(500).json({
          status: 'error',
          message: 'Authentication system error',
          code: 'TOKEN_GENERATION_ERROR'
        });
      }

      console.log(`🎉 Successful login for ${user.userType}: ${email}`);

      // Réponse de succès avec structure simplifiée et robuste
      return res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: user.toPublicJSON(),
          profile: profile ? profile.toJSON() : null,
          tokens: tokens
        }
      });

    } catch (error) {
      console.error('❌ Login error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Login failed due to server error',
        code: 'LOGIN_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
   * 🔄 Rafraîchissement du token d'accès
   */
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Refresh token is required',
          code: 'MISSING_REFRESH_TOKEN'
        });
      }

      // Vérifier et décoder le refresh token
      let decoded;
      try {
        decoded = AuthService.verifyRefreshToken(refreshToken);
      } catch (tokenError) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }

      // Récupérer l'utilisateur
      const user = await User.findByPk(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'User not found or inactive',
          code: 'USER_NOT_FOUND'
        });
      }

      // Générer de nouveaux tokens
      const tokens = AuthService.generateTokenPair(user);

      console.log(`🔄 Token refreshed for user: ${user.email}`);

      return res.json({
        status: 'success',
        message: 'Token refreshed successfully',
        data: {
          tokens: tokens
        }
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Token refresh failed',
        code: 'TOKEN_REFRESH_ERROR'
      });
    }
  }

  /**
   * 🚪 Déconnexion (invalidation du token)
   */
  static async logout(req, res) {
    try {
      // Dans une implémentation complète, vous pourriez ajouter le token à une blacklist
      // Pour ce prototype, nous nous contentons d'une réponse de succès
      
      console.log(`🚪 User logged out: ${req.user.email}`);
      
      return res.json({
        status: 'success',
        message: 'Logout successful'
      });

    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Logout failed',
        code: 'LOGOUT_ERROR'
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