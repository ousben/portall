// portall/server/controllers/authController.js

const { User, PlayerProfile, CoachProfile, NJCAACollege, NCAACollege } = require('../models');
const AuthService = require('../services/authService');
const { sequelize } = require('../config/database.connection');
const { Op } = require('sequelize');

/**
 * Contrôleur d'authentification étendu pour Phase 3
 * 
 * Gère maintenant l'inscription avec profils spécialisés (joueur/coach)
 * et validation des données métier spécifiques.
 */
class AuthController {
  /**
   * Inscription d'un nouveau utilisateur avec profil étendu
   * 
   * Cette version gère la création simultanée de l'utilisateur
   * ET de son profil spécialisé dans une transaction atomique.
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

      console.log(`🔐 Enhanced registration attempt for: ${email} as ${userType}`);

      // Étape 1: Vérifier que l'email n'existe pas déjà
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        await transaction.rollback();
        return res.status(409).json({
          status: 'error',
          message: 'An account with this email already exists',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }

      // Étape 2: Validation spécifique selon le type d'utilisateur
      const profileValidation = await this.validateProfileData(userType, profileData);
      if (!profileValidation.isValid) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Profile validation failed',
          errors: profileValidation.errors
        });
      }

      // Étape 3: Créer l'utilisateur de base
      const emailVerificationToken = AuthService.generateSecureToken();
      
      const newUser = await User.create({
        email,
        password, // Sera hashé par le hook
        firstName,
        lastName,
        userType,
        emailVerificationToken,
        isActive: false, // Toujours inactif en attendant validation admin
        isEmailVerified: false
      }, { transaction });

      console.log(`✅ Base user created: ${newUser.email} (ID: ${newUser.id})`);

      // Étape 4: Créer le profil spécialisé selon le type
      let profile = null;
      if (userType === 'player') {
        profile = await this.createPlayerProfile(newUser.id, profileData, transaction);
      } else if (userType === 'coach') {
        profile = await this.createCoachProfile(newUser.id, profileData, transaction);
      }

      // Étape 5: Confirmer la transaction
      await transaction.commit();

      console.log(`🎉 Complete registration successful for: ${newUser.email}`);

      // Préparer la réponse avec les informations du profil
      const userResponse = newUser.toPublicJSON();
      
      return res.status(201).json({
        status: 'success',
        message: 'Account created successfully. Please wait for admin approval.',
        data: {
          user: userResponse,
          profile: profile ? profile.toJSON() : null
        },
        meta: {
          nextSteps: [
            'Check your email for verification instructions',
            'Wait for admin approval',
            'Complete payment after approval',
            'Access your personalized dashboard'
          ]
        }
      });

    } catch (error) {
      // En cas d'erreur, annuler TOUTE la transaction
      await transaction.rollback();
      
      console.error('Enhanced registration error:', error);

      // Gestion spécifique des erreurs de validation Sequelize
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => ({
          field: err.path,
          message: err.message
        }));

        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: validationErrors
        });
      }

      return res.status(500).json({
        status: 'error',
        message: 'Registration failed. Please try again later.',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * Validation des données de profil selon le type d'utilisateur
   * 
   * Cette méthode encapsule toute la logique de validation métier
   * spécifique à chaque type d'utilisateur.
   */
  static async validateProfileData(userType, profileData) {
    const errors = [];

    try {
      if (userType === 'player') {
        // Validation pour les joueurs NJCAA
        const { gender, collegeId } = profileData;

        if (!gender || !['male', 'female'].includes(gender)) {
          errors.push({
            field: 'gender',
            message: 'Gender is required and must be male or female'
          });
        }

        if (!collegeId) {
          errors.push({
            field: 'collegeId',
            message: 'College selection is required'
          });
        } else {
          // Vérifier que le college NJCAA existe et est actif
          const college = await NJCAACollege.findByPk(collegeId);
          if (!college || !college.isActive) {
            errors.push({
              field: 'collegeId',
              message: 'Selected college is not valid or inactive'
            });
          }
        }

      } else if (userType === 'coach') {
        // Validation pour les coachs NCAA/NAIA
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
            message: 'Valid phone number is required'
          });
        }

        if (!division || !['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia'].includes(division)) {
          errors.push({
            field: 'division',
            message: 'Valid division is required'
          });
        }

        if (!teamSport || !['mens_soccer', 'womens_soccer'].includes(teamSport)) {
          errors.push({
            field: 'teamSport',
            message: 'Team sport selection is required'
          });
        }

        if (!collegeId) {
          errors.push({
            field: 'collegeId',
            message: 'College selection is required'
          });
        } else {
          // Vérifier que le college NCAA existe, est actif, et correspond à la division
          const college = await NCAACollege.findByPk(collegeId);
          if (!college || !college.isActive || college.division !== division) {
            errors.push({
              field: 'collegeId',
              message: 'Selected college does not match the specified division or is inactive'
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
          message: 'Validation process failed'
        }]
      };
    }
  }

  /**
   * Crée un profil joueur avec toutes les validations nécessaires
   */
  static async createPlayerProfile(userId, profileData, transaction) {
    const { gender, collegeId } = profileData;

    const playerProfile = await PlayerProfile.create({
      userId: userId,
      gender: gender,
      collegeId: collegeId,
      profileCompletionStatus: 'basic',
      isProfileVisible: false, // Invisible jusqu'à validation admin
      profileViews: 0,
      lastProfileUpdate: new Date()
    }, { transaction });

    console.log(`👤 Player profile created for user ${userId}`);
    return playerProfile;
  }

  /**
   * Crée un profil coach avec toutes les validations nécessaires
   */
  static async createCoachProfile(userId, profileData, transaction) {
    const { position, phoneNumber, collegeId, division, teamSport } = profileData;

    const coachProfile = await CoachProfile.create({
      userId: userId,
      position: position,
      phoneNumber: phoneNumber,
      collegeId: collegeId,
      division: division,
      teamSport: teamSport,
      savedSearches: [],
      totalSearches: 0
    }, { transaction });

    console.log(`🏟️ Coach profile created for user ${userId}`);
    return coachProfile;
  }

  /**
   * Connexion d'un utilisateur (méthode existante inchangée)
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      console.log(`🔐 Login attempt for: ${email}`);

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        console.log(`❌ Invalid password for user: ${email}`);
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          status: 'error',
          message: 'Account is not activated. Please wait for admin approval.',
          code: 'ACCOUNT_NOT_ACTIVE'
        });
      }

      const tokenPair = AuthService.generateTokenPair(user);
      await user.updateLastLogin();

      console.log(`✅ Login successful for user: ${email}`);

      // Récupérer le profil complet pour le frontend
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
   */
  static async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      console.log('🔄 Token refresh attempt');

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

      if (decoded.tokenType !== 'refresh') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token type',
          code: 'INVALID_TOKEN_TYPE'
        });
      }

      const user = await User.findByPk(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'User not found or inactive',
          code: 'USER_NOT_FOUND'
        });
      }

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
   */
  static async getMe(req, res) {
    try {
      const user = req.user;

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
   * Demande de reset de mot de passe (méthode existante inchangée)
   */
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      console.log(`🔑 Password reset request for: ${email}`);

      const user = await User.findByEmail(email);
      
      const standardResponse = {
        status: 'success',
        message: 'If an account with this email exists, password reset instructions have been sent.'
      };

      if (!user) {
        console.log(`❌ Password reset requested for non-existent email: ${email}`);
        return res.status(200).json(standardResponse);
      }

      const resetToken = AuthService.generateSecureToken();
      const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 heure

      await user.update({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      });

      console.log(`✅ Password reset token generated for: ${email}`);

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
   */
  static async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      console.log('🔑 Password reset attempt with token');

      const user = await User.findOne({
        where: {
          passwordResetToken: token,
          passwordResetExpires: {
            [Op.gt]: new Date()
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

      await user.update({
        password: password,
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