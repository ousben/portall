// portall/server/controllers/authController.js

const { User, PlayerProfile, CoachProfile, NJCAACoachProfile, NJCAACollege, NCAACollege } = require('../models');
const AuthService = require('../services/authService');
const emailService = require('../services/emailService');
const { sequelize } = require('../config/database.connection');
const { Op } = require('sequelize');

/**
 * Contrôleur d'authentification étendu pour Phase 3 avec notifications email
 * 
 * Ce contrôleur gère maintenant l'inscription avec profils spécialisés (joueur/coach)
 * ET l'envoi automatique d'emails de notification à chaque étape du processus.
 * 
 * Nouveautés Phase 3 :
 * - Validation des données métier spécifiques (colleges, divisions)
 * - Création de profils étendus lors de l'inscription
 * - Envoi automatique d'emails de bienvenue
 * - Notification automatique des admins pour nouvelles inscriptions
 * - Emails de réinitialisation de mot de passe avec templates
 * 
 * Architecture : Ce contrôleur suit le pattern de votre architecture existante
 * en utilisant des services découplés (AuthService, emailService) pour
 * maintenir la séparation des responsabilités.
 */
class AuthController {
  /**
   * Inscription d'un nouveau utilisateur avec profil étendu et notifications email
   * 
   * Cette version complète gère la création simultanée de l'utilisateur
   * ET de son profil spécialisé dans une transaction atomique, puis déclenche
   * automatiquement les notifications email appropriées.
   * 
   * Processus complet :
   * 1. Validation des données (syntaxe + logique métier)
   * 2. Création utilisateur + profil dans une transaction
   * 3. Email de bienvenue à l'utilisateur (asynchrone)
   * 4. Notification aux admins (asynchrone)
   * 5. Réponse immédiate au client
   */
  static async register(req, res) {
    // Démarrer une transaction pour garantir l'atomicité
    const transaction = await sequelize.transaction();

    try {
      const { 
        email, 
        password, 
        firstName, 
        lastName, 
        userType,
        // Nouveaux champs selon le type d'utilisateur
        ...profileData 
      } = req.body;

      console.log(`🔐 Enhanced registration with email notifications for: ${email} as ${userType}`);

      // ========================
      // ÉTAPE 1 : VÉRIFICATIONS DE SÉCURITÉ DE BASE
      // ========================
      
      // Vérifier que l'email n'existe pas déjà
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
      
      // Validation spécifique selon le type d'utilisateur
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

      // 1. Email de bienvenue à l'utilisateur
      emailService.sendWelcomeEmail(newUser)
        .then(result => {
          if (result.success) {
            console.log(`📧 Welcome email sent to ${newUser.email}`);
            // En développement, afficher le lien de preview
            if (result.previewUrl) {
              console.log(`👀 Email preview: ${result.previewUrl}`);
            }
          } else {
            console.error(`❌ Failed to send welcome email to ${newUser.email}:`, result.error);
          }
        })
        .catch(error => {
          console.error(`❌ Welcome email error for ${newUser.email}:`, error);
        });

      // 2. Notification aux admins pour traitement
      emailService.sendAdminNotificationEmail(newUser, userType)
        .then(result => {
          if (result.success) {
            console.log(`📧 Admin notification sent for new ${userType}: ${newUser.email}`);
          } else {
            console.error(`❌ Failed to send admin notification for ${newUser.email}:`, result.error);
          }
        })
        .catch(error => {
          console.error(`❌ Admin notification error for ${newUser.email}:`, error);
        });

      // ========================
      // ÉTAPE 7 : RÉPONSE IMMÉDIATE AU CLIENT
      // ========================
      
      // Réponse adaptée selon le type d'utilisateur
      const responseMessage = AuthController.getRegistrationSuccessMessage(userType);
      
      return res.status(201).json({
        status: 'success',
        message: responseMessage,
        data: {
          user: newUser.toPublicJSON(),
          userType: userType,
          profileCreated: !!profile,
          nextSteps: {
            emailVerification: false, // Géré par validation admin
            adminApproval: true,
            estimatedApprovalTime: '24-48 hours'
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
   * NOUVELLE MÉTHODE : Création du profil coach NJCAA
   * 
   * Cette méthode crée un profil spécialisé pour les coachs NJCAA
   * avec leurs données métier spécifiques.
   */
  static async createNJCAACoachProfile(userId, profileData, transaction) {
    try {
      console.log(`🏟️ Creating NJCAA coach profile for user ${userId}`);
      
      const { position, phoneNumber, collegeId, division, teamSport } = profileData;
      
      // Gérer les données de college enrichies (depuis la validation Joi externe)
      let actualCollegeId;
      if (typeof collegeId === 'object' && collegeId.collegeId) {
        actualCollegeId = collegeId.collegeId;
      } else {
        actualCollegeId = parseInt(collegeId, 10);
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
   * MÉTHODE MISE À JOUR : Message de succès d'inscription adapté au type
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
   * Notification automatique des admins
   * 
   * Cette méthode récupère tous les administrateurs actifs et leur envoie
   * une notification de nouvelle inscription nécessitant leur attention.
   * 
   * Pattern utilisé : Service discovery pattern - on trouve dynamiquement
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
   * Validation des données de profil selon le type d'utilisateur
   * 
   * Cette méthode encapsule toute la logique de validation métier
   * spécifique à chaque type d'utilisateur. Elle vérifie non seulement
   * le format des données, mais aussi leur cohérence business.
   */

  /**
   * Validation des données de profil avec gestion intelligente des données enrichies
   */
  static async validateProfileData(userType, profileData) {
    
    const errors = [];

    try {
      // Import des modèles au moment de l'exécution
      const models = require('../models');

      if (userType === 'player') {
        
        const { gender, collegeId } = profileData;

        // Validation basique du genre
        if (!gender || !['male', 'female'].includes(gender)) {
          errors.push({
            field: 'gender',
            message: 'Gender is required and must be male or female'
          });
        }

        // SOLUTION INTELLIGENTE : Gérer les données de college enrichies
        let actualCollegeId;
        let collegeData = null;

        if (!collegeId) {
          errors.push({
            field: 'collegeId',
            message: 'College selection is required'
          });
        } else if (typeof collegeId === 'object' && collegeId.collegeId) {
          // Cas où les données sont enrichies par la validation Joi externe
          actualCollegeId = collegeId.collegeId;
          collegeData = collegeId.collegeData;
        } else if (typeof collegeId === 'number' || typeof collegeId === 'string') {
          // Cas où nous avons un ID simple
          actualCollegeId = parseInt(collegeId, 10);
        } else {
          errors.push({
            field: 'collegeId',
            message: 'Invalid college ID format'
          });
        }

        // Valider l'ID numérique si nous l'avons extrait
        if (actualCollegeId !== undefined) {
          if (isNaN(actualCollegeId)) {
            errors.push({
              field: 'collegeId',
              message: 'College ID must be a valid number'
            });
          } else {
            // Si nous avons déjà les données du college (validation Joi externe), les utiliser
            if (collegeData) {
              if (!collegeData.isActive) {
                errors.push({
                  field: 'collegeId',
                  message: 'Selected college is not active'
                });
              }
            } else {
              // Sinon, faire la validation de base de données
              try {
                const college = await models.NJCAACollege.findByPk(actualCollegeId);
                
                if (!college) {
                  errors.push({
                    field: 'collegeId',
                    message: 'Selected college does not exist'
                  });
                } else if (!college.isActive) {
                  errors.push({
                    field: 'collegeId',
                    message: 'Selected college is not active'
                  });
                }
              } catch (dbError) {
                errors.push({
                  field: 'collegeId',
                  message: 'Error validating college selection'
                });
              }
            }
          }
        }

      } else if (userType === 'coach') {
        
        const { position, phoneNumber, collegeId, division, teamSport } = profileData;

        // Validations de base pour les coachs
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

        // Gestion similaire pour les coachs NCAA
        let actualCollegeId;
        if (typeof collegeId === 'object' && collegeId.collegeId) {
          actualCollegeId = collegeId.collegeId;
        } else {
          actualCollegeId = parseInt(collegeId, 10);
        }

        // Validation college NCAA
        if (collegeId) {
          try {
            const college = await models.NCAACollege.findByPk(collegeId);
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
        // Pour simplifier, on ne fait pas la validation croisée division/college pour l'instant
      } else if (userType === 'njcaa_coach') {
        // NOUVELLE VALIDATION : Pour les coachs NJCAA
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

        // Validation division NJCAA spécifique
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
            message: 'Team sport must be mens_soccer or womens_soccer'
          });
        }

        // Validation college NJCAA (différent des coachs NCAA)
        let actualCollegeId;
        let collegeData = null;

        if (!collegeId) {
          errors.push({
            field: 'collegeId',
            message: 'NJCAA college selection is required'
          });
        } else if (typeof collegeId === 'object' && collegeId.collegeId) {
          actualCollegeId = collegeId.collegeId;
          collegeData = collegeId.collegeData;
        } else if (typeof collegeId === 'number' || typeof collegeId === 'string') {
          actualCollegeId = parseInt(collegeId, 10);
        } else {
          errors.push({
            field: 'collegeId',
            message: 'Invalid college ID format'
          });
        }

        // Validation du college NJCAA en base de données
        if (actualCollegeId !== undefined && !isNaN(actualCollegeId)) {
          if (collegeData) {
            if (!collegeData.isActive) {
              errors.push({
                field: 'collegeId',
                message: 'Selected NJCAA college is not active'
              });
            }
          } else {
            try {
              const college = await models.NJCAACollege.findByPk(actualCollegeId);
              
              if (!college) {
                errors.push({
                  field: 'collegeId',
                  message: 'Selected NJCAA college does not exist'
                });
              } else if (!college.isActive) {
                errors.push({
                  field: 'collegeId',
                  message: 'Selected NJCAA college is not active'
                });
              }
            } catch (dbError) {
              errors.push({
                field: 'collegeId',
                message: 'Error validating NJCAA college selection'
              });
            }
          }
        }
      }
      
      const result = {
        isValid: errors.length === 0,
        errors: errors
      };
      
      return result;

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

  /**
   * Crée un profil joueur avec toutes les validations nécessaires
   * 
   * Cette méthode initialise un profil joueur avec des valeurs par défaut
   * sensées qui correspondent à votre logique métier.
   */
  static async createPlayerProfile(userId, profileData, transaction) {
    // Import des modèles au moment de l'exécution
    const { PlayerProfile } = require('../models');

    const { gender, collegeId } = profileData;

    // SOLUTION : Extraction intelligente de l'ID numérique du college
    let actualCollegeId;

    if (typeof collegeId === 'object' && collegeId.collegeId) {
      // Cas où les données sont enrichies par la validation Joi externe
      actualCollegeId = collegeId.collegeId;
      console.log('✅ [createPlayerProfile] Using enriched college ID:', actualCollegeId);
    } else if (typeof collegeId === 'number' || typeof collegeId === 'string') {
      // Cas où nous avons un ID simple
      actualCollegeId = parseInt(collegeId, 10);
      console.log('✅ [createPlayerProfile] Using simple college ID:', actualCollegeId);
    } else {
      console.error('❌ [createPlayerProfile] Invalid college ID format:', collegeId);
      throw new Error('Invalid college ID format for player profile creation');
    }

    const playerProfile = await PlayerProfile.create({
      userId: userId,
      gender: gender,
      collegeId: actualCollegeId,
      profileCompletionStatus: 'basic', // Le joueur devra compléter plus tard
      isProfileVisible: false, // Invisible jusqu'à validation admin
      profileViews: 0,
      lastProfileUpdate: new Date()
    }, { transaction });

    console.log(`👤 Player profile created for user ${userId}`);
    return playerProfile;
  }

  /**
   * Crée un profil coach avec toutes les validations nécessaires
   * 
   * Cette méthode initialise un profil coach avec les données
   * professionnelles fournies lors de l'inscription.
   */
  static async createCoachProfile(userId, profileData, transaction) {
    // Import des modèles au moment de l'exécution
    const { CoachProfile } = require('../models');

    const { position, phoneNumber, collegeId, division, teamSport } = profileData;

    // SOLUTION : Extraction intelligente de l'ID numérique du college NCAA
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

    console.log(`🏟️ Coach profile created for user ${userId}`);
    return coachProfile;
  }

  /**
   * Connexion d'un utilisateur (méthode existante améliorée)
   * 
   * Cette méthode reste largement identique mais inclut maintenant
   * la récupération du profil complet pour le frontend.
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

      console.log(`✅ Login successful for user: ${email}`);

      // AMÉLIORATION : Récupérer le profil complet pour le frontend
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
   * Rafraîchissement des tokens (méthode existante inchangée)
   * 
   * Cette méthode permet de renouveler les tokens d'accès sans
   * redemander à l'utilisateur de se reconnecter.
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
   * Déconnexion (méthode existante inchangée)
   * 
   * Avec JWT, la déconnexion côté serveur est principalement
   * symbolique puisque les tokens sont stateless.
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
   * Obtenir le profil de l'utilisateur connecté (méthode améliorée)
   * 
   * Cette méthode récupère maintenant le profil complet avec
   * toutes les relations pour fournir toutes les données
   * nécessaires au frontend.
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
   * MISE À JOUR : Demande de reset de mot de passe avec email automatique
   * 
   * Cette méthode génère maintenant un token de reset ET envoie
   * automatiquement l'email avec le lien de réinitialisation.
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
        console.log(`❌ Password reset requested for non-existent email: ${email}`);
        return res.status(200).json(standardResponse);
      }

      // Générer un token de reset sécurisé
      const resetToken = AuthService.generateSecureToken();
      const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 heure d'expiration

      // Sauvegarder le token en base
      await user.update({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      });

      // NOUVEAU : Envoyer l'email de reset automatiquement
      emailService.sendPasswordResetEmail(user, resetToken)
        .then(result => {
          if (result.success) {
            console.log(`📧 Password reset email sent to ${user.email}`);
            // En développement, afficher le lien de preview
            if (result.previewUrl) {
              console.log(`👀 Email preview: ${result.previewUrl}`);
            }
          } else {
            console.error(`❌ Failed to send password reset email:`, result.error);
          }
        })
        .catch(error => {
          console.error(`❌ Password reset email error:`, error);
        });

      console.log(`✅ Password reset process initiated for: ${email}`);

      return res.status(200).json(standardResponse);

    } catch (error) {
      console.error('Forgot password error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Password reset request failed',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * Reset du mot de passe avec le token (méthode existante inchangée)
   * 
   * Cette méthode valide le token de reset et met à jour
   * le mot de passe de l'utilisateur.
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
}

module.exports = AuthController;