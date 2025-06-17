// portall/server/controllers/authController.js

const { User } = require('../models');
const AuthService = require('../services/authService');
const { Op } = require('sequelize');

class AuthController {
  /**
   * Inscription d'un nouveau utilisateur
   * 
   * Processus étape par étape :
   * 1. Vérifier que l'email n'existe pas déjà
   * 2. Créer l'utilisateur (le mot de passe sera automatiquement hashé par le hook)
   * 3. Générer un token de vérification email
   * 4. Retourner les informations utilisateur (sans mot de passe)
   */
  static async register(req, res) {
    try {
      const { email, password, firstName, lastName, userType } = req.body;

      console.log(`🔐 Registration attempt for: ${email}`);

      // Étape 1: Vérifier si l'email existe déjà
      // C'est comme vérifier si quelqu'un a déjà ce nom dans le registre
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          status: 'error',
          message: 'An account with this email already exists',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }

      // Étape 2: Générer un token de vérification email
      // C'est comme créer un code de confirmation unique
      const emailVerificationToken = AuthService.generateSecureToken();

      // Étape 3: Créer l'utilisateur
      // Le hook beforeCreate va automatiquement hasher le mot de passe
      const newUser = await User.create({
        email,
        password, // Sera hashé automatiquement
        firstName,
        lastName,
        userType,
        emailVerificationToken,
        // Nouveau utilisateur = inactif jusqu'à validation admin
        isActive: false,
        isEmailVerified: false
      });

      console.log(`✅ User created successfully: ${newUser.email} (ID: ${newUser.id})`);

      // Étape 4: Préparer la réponse
      // On ne renvoie jamais le mot de passe, même hashé !
      const userResponse = newUser.toPublicJSON();

      // En Phase 3, nous ajouterons l'envoi d'email de vérification ici
      // await EmailService.sendVerificationEmail(newUser, emailVerificationToken);

      return res.status(201).json({
        status: 'success',
        message: 'Account created successfully. Please wait for admin approval.',
        data: {
          user: userResponse
        },
        meta: {
          nextSteps: [
            'Check your email for verification instructions',
            'Wait for admin approval',
            'You will receive a notification when your account is activated'
          ]
        }
      });

    } catch (error) {
      console.error('Registration error:', error);

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

      // Erreur générique
      return res.status(500).json({
        status: 'error',
        message: 'Registration failed. Please try again later.',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * Connexion d'un utilisateur
   * 
   * Ce processus est comme un contrôle de sécurité à l'aéroport :
   * 1. Vérifier l'identité (email + mot de passe)
   * 2. Vérifier que la personne est autorisée à entrer (compte actif)
   * 3. Délivrer les badges d'accès (tokens)
   * 4. Enregistrer l'heure de passage (lastLogin)
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      console.log(`🔐 Login attempt for: ${email}`);

      // Étape 1: Trouver l'utilisateur par email
      const user = await User.findByEmail(email);
      if (!user) {
        // SÉCURITÉ: On ne révèle pas si l'email existe ou non
        // Cela évite les attaques d'énumération d'emails
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Étape 2: Vérifier le mot de passe
      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        console.log(`❌ Invalid password for user: ${email}`);
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Étape 3: Vérifier que le compte est actif
      if (!user.isActive) {
        return res.status(403).json({
          status: 'error',
          message: 'Account is not activated. Please wait for admin approval.',
          code: 'ACCOUNT_NOT_ACTIVE'
        });
      }

      // Étape 4: Générer les tokens
      const tokenPair = AuthService.generateTokenPair(user);

      // Étape 5: Mettre à jour la dernière connexion
      await user.updateLastLogin();

      console.log(`✅ Login successful for user: ${email}`);

      // Étape 6: Préparer la réponse
      const userResponse = user.toPublicJSON();

      return res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: userResponse,
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
   * Rafraîchissement des tokens
   * 
   * C'est comme renouveler votre carte d'identité :
   * Vous montrez l'ancienne (refresh token) pour obtenir une nouvelle (access token)
   */
  static async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      console.log('🔄 Token refresh attempt');

      // Étape 1: Vérifier le refresh token
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

      // Étape 2: S'assurer que c'est bien un refresh token
      if (decoded.tokenType !== 'refresh') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token type',
          code: 'INVALID_TOKEN_TYPE'
        });
      }

      // Étape 3: Récupérer l'utilisateur
      const user = await User.findByPk(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'User not found or inactive',
          code: 'USER_NOT_FOUND'
        });
      }

      // Étape 4: Générer de nouveaux tokens
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
   * Déconnexion
   * 
   * En JWT, la déconnexion côté serveur est délicate car les tokens sont stateless.
   * Pour l'instant, nous informons simplement le client de supprimer ses tokens.
   * En Phase 4, nous pourrons implémenter une blacklist de tokens.
   */
  static async logout(req, res) {
    try {
      const user = req.user; // Injecté par le middleware d'authentification

      console.log(`🚪 Logout for user: ${user.email}`);

      // En Phase 4, nous ajouterons le token à une blacklist ici
      // await TokenBlacklistService.addToken(req.token);

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
   * Obtenir le profil de l'utilisateur connecté
   * 
   * Route utile pour que le frontend puisse récupérer les infos de l'utilisateur
   * quand l'application se charge
   */
  static async getMe(req, res) {
    try {
      const user = req.user; // Injecté par le middleware d'authentification

      // Récupérer les données fraîches de la base de données
      const freshUser = await User.findByPk(user.id);
      
      if (!freshUser) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      const userResponse = freshUser.toPublicJSON();

      return res.status(200).json({
        status: 'success',
        data: {
          user: userResponse
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
   * Demande de reset de mot de passe
   * 
   * Processus en deux étapes : demande puis reset
   * Cette fonction gère la première étape
   */
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      console.log(`🔑 Password reset request for: ${email}`);

      const user = await User.findByEmail(email);
      
      // SÉCURITÉ: On répond toujours la même chose, que l'email existe ou non
      // Cela évite l'énumération d'emails
      const standardResponse = {
        status: 'success',
        message: 'If an account with this email exists, password reset instructions have been sent.'
      };

      if (!user) {
        // On fait semblant d'envoyer un email même si l'utilisateur n'existe pas
        console.log(`❌ Password reset requested for non-existent email: ${email}`);
        return res.status(200).json(standardResponse);
      }

      // Générer un token de reset
      const resetToken = AuthService.generateSecureToken();
      const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 heure

      // Sauvegarder le token de reset
      await user.update({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      });

      // En Phase 3, nous enverrons l'email ici
      // await EmailService.sendPasswordResetEmail(user, resetToken);

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
   * Reset du mot de passe avec le token
   * 
   * Deuxième étape du processus de reset
   */
  static async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      console.log('🔑 Password reset attempt with token');

      // Trouver l'utilisateur avec ce token de reset valide
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

      // Mettre à jour le mot de passe (sera hashé par le hook beforeUpdate)
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