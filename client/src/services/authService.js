// portall/client/src/services/authService.js

import api, { setTokens, removeTokens } from './api';

class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   * @param {Object} userData - Données d'inscription
   * @returns {Promise} Réponse de l'API
   */
  static async register(userData) {
    try {
      const response = await api.post('/auth/register', userData);
      return {
        success: true,
        data: response.data,
        message: response.data.message
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed',
        errors: error.response?.data?.errors || []
      };
    }
  }

  /**
   * Connexion d'un utilisateur
   * @param {string} email - Email de l'utilisateur
   * @param {string} password - Mot de passe
   * @returns {Promise} Réponse de l'API avec tokens
   */
  static async login(email, password) {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      const { user, tokens } = response.data.data;
      
      // Sauvegarder les tokens et les infos utilisateur
      setTokens(tokens.accessToken, tokens.refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      
      return {
        success: true,
        user,
        tokens,
        message: response.data.message
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed',
        code: error.response?.data?.code
      };
    }
  }

  /**
   * Déconnexion de l'utilisateur
   * @returns {Promise} Réponse de l'API
   */
  static async logout() {
    try {
      // Appeler l'API de logout (optionnel car JWT est stateless)
      await api.post('/auth/logout');
    } catch (error) {
      // On ignore les erreurs de logout côté serveur
      console.warn('Logout API call failed:', error.message);
    } finally {
      // Toujours nettoyer le localStorage
      removeTokens();
    }
    
    return { success: true };
  }

  /**
   * Obtenir le profil de l'utilisateur connecté
   * @returns {Promise} Profil utilisateur
   */
  static async getProfile() {
    try {
      const response = await api.get('/auth/me');
      
      // Mettre à jour les infos utilisateur dans le localStorage
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
      
      return {
        success: true,
        user: response.data.data.user
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get profile'
      };
    }
  }

  /**
   * Demande de reset de mot de passe
   * @param {string} email - Email de l'utilisateur
   * @returns {Promise} Réponse de l'API
   */
  static async forgotPassword(email) {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return {
        success: true,
        message: response.data.message
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Password reset request failed'
      };
    }
  }

  /**
   * Reset du mot de passe avec token
   * @param {string} token - Token de reset
   * @param {string} password - Nouveau mot de passe
   * @param {string} confirmPassword - Confirmation du mot de passe
   * @returns {Promise} Réponse de l'API
   */
  static async resetPassword(token, password, confirmPassword) {
    try {
      const response = await api.post('/auth/reset-password', {
        token,
        password,
        confirmPassword
      });
      return {
        success: true,
        message: response.data.message
      };
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Password reset failed',
        errors: error.response?.data?.errors || []
      };
    }
  }

  /**
   * Vérifier si l'utilisateur est connecté
   * @returns {boolean} True si connecté
   */
  static isAuthenticated() {
    try {
      const token = localStorage.getItem('accessToken');
      const user = localStorage.getItem('user');
      return !!(token && user);
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Obtenir l'utilisateur depuis le localStorage
   * @returns {Object|null} Utilisateur ou null
   */
  static getCurrentUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }
}

export default AuthService;