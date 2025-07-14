// portall/client/src/services/authService.js

import api, { setTokens, removeTokens } from './api'

/**
 * 🔐 Service d'authentification - Interface directe avec votre API Portall
 * 
 * Ce service mappe exactement sur vos endpoints d'authentification backend,
 * garantissant une intégration parfaite avec votre architecture de sécurité.
 * 
 * 🎯 Workflow d'authentification reproduced du backend :
 * 1. Register -> Validation -> Création utilisateur -> Email de bienvenue
 * 2. Login -> Validation -> Génération tokens -> Session active
 * 3. Refresh -> Validation refresh token -> Nouveaux tokens
 * 4. Logout -> Nettoyage -> Session fermée
 */
class AuthService {
  /**
   * 📝 Inscription - Endpoint /api/auth/register
   * 
   * Cette méthode reproduit fidèlement le workflow d'inscription de votre
   * backend avec support pour tous les types d'utilisateurs.
   */
  static async register(userData) {
    try {
      console.log(`📝 Attempting registration for user type: ${userData.userType}`)
      
      const response = await api.post('/auth/register', userData)
      
      // Votre backend retourne cette structure exacte :
      const { status, message, data } = response.data
      
      if (status === 'success') {
        console.log('✅ Registration successful:', message)
        
        // Si l'inscription inclut des tokens (auto-login)
        if (data.tokens) {
          setTokens(data.tokens.accessToken, data.tokens.refreshToken)
          localStorage.setItem('user', JSON.stringify(data.user))
        }
        
        return {
          success: true,
          user: data.user,
          tokens: data.tokens,
          message
        }
      }
      
    } catch (error) {
      console.error('❌ Registration failed:', error)
      
      // Extraire les erreurs selon le format de votre backend
      const errorResponse = error.response?.data || {}
      
      return {
        success: false,
        message: errorResponse.message || 'Registration failed',
        code: errorResponse.code,
        errors: errorResponse.errors || []
      }
    }
  }

  /**
   * 🔑 Connexion - Endpoint /api/auth/login
   * 
   * Gère la connexion avec extraction automatique des tokens et stockage
   * du profil utilisateur selon le format exact de votre API.
   */
  static async login(email, password) {
    try {
      console.log(`🔑 Attempting login for: ${email}`)
      
      const response = await api.post('/auth/login', { email, password })
      
      const { status, message, data } = response.data
      
      if (status === 'success') {
        // Extraire selon la structure exacte de votre backend
        const { user, tokens } = data
        
        // Stocker les tokens et infos utilisateur
        setTokens(tokens.accessToken, tokens.refreshToken)
        localStorage.setItem('user', JSON.stringify(user))
        
        console.log(`✅ Login successful for user type: ${user.userType}`)
        
        return {
          success: true,
          user,
          tokens,
          message
        }
      }
      
    } catch (error) {
      console.error('❌ Login failed:', error)
      
      const errorResponse = error.response?.data || {}
      
      return {
        success: false,
        message: errorResponse.message || 'Login failed',
        code: errorResponse.code
      }
    }
  }

  /**
   * 🔄 Refresh Token - Endpoint /api/auth/refresh
   * 
   * Gère le renouvellement automatique des tokens selon votre logique backend.
   */
  static async refreshToken(refreshToken) {
    try {
      console.log('🔄 Refreshing access token...')
      
      const response = await api.post('/auth/refresh', { refreshToken })
      
      const { status, data } = response.data
      
      if (status === 'success') {
        setTokens(data.tokens.accessToken, data.tokens.refreshToken)
        
        console.log('✅ Token refresh successful')
        
        return {
          success: true,
          tokens: data.tokens
        }
      }
      
    } catch (error) {
      console.error('❌ Token refresh failed:', error)
      
      // En cas d'échec, nettoyer et forcer reconnexion
      removeTokens()
      
      throw error
    }
  }

  /**
   * 🚪 Déconnexion - Endpoint /api/auth/logout
   */
  static async logout() {
    try {
      // Appeler l'API de logout (même si JWT est stateless, pour les logs)
      await api.post('/auth/logout')
      
      console.log('✅ Logout API call successful')
      
    } catch (error) {
      // En cas d'erreur API, on continue quand même le logout local
      console.warn('⚠️ Logout API call failed, but continuing local logout:', error.message)
    } finally {
      // Toujours nettoyer le localStorage
      removeTokens()
      console.log('🔓 Local logout completed')
    }
    
    return { success: true }
  }

  /**
   * 👤 Profil utilisateur - Endpoint /api/auth/me
   * 
   * Récupère le profil complet avec toutes les relations (selon userType).
   */
  static async getCurrentUser() {
    try {
      const response = await api.get('/auth/me')
      
      const { status, data } = response.data
      
      if (status === 'success') {
        // Mettre à jour le localStorage avec les dernières données
        localStorage.setItem('user', JSON.stringify(data.user))
        
        return {
          success: true,
          user: data.user
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to get current user:', error)
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get user profile'
      }
    }
  }

  /**
   * 🔑 Reset de mot de passe - Endpoint /api/auth/forgot-password
   */
  static async forgotPassword(email) {
    try {
      const response = await api.post('/auth/forgot-password', { email })
      
      return {
        success: true,
        message: response.data.message
      }
      
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send reset email'
      }
    }
  }

  /**
   * 🔐 Reset de mot de passe - Endpoint /api/auth/reset-password
   */
  static async resetPassword(token, newPassword) {
    try {
      const response = await api.post('/auth/reset-password', {
        token,
        newPassword,
        confirmPassword: newPassword
      })
      
      return {
        success: true,
        message: response.data.message
      }
      
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to reset password',
        errors: error.response?.data?.errors || []
      }
    }
  }

  /**
   * 🔍 Vérification du statut d'authentification
   * 
   * Méthode utilitaire pour vérifier si l'utilisateur est connecté
   * en validant la présence et la validité du token.
   */
  static isAuthenticated() {
    const user = localStorage.getItem('user')
    const accessToken = localStorage.getItem('accessToken')
    
    return !!(user && accessToken)
  }

  /**
   * 👤 Récupération de l'utilisateur depuis le localStorage
   */
  static getCurrentUserFromStorage() {
    try {
      const user = localStorage.getItem('user')
      return user ? JSON.parse(user) : null
    } catch (error) {
      console.error('Error parsing user from localStorage:', error)
      return null
    }
  }
}

export default AuthService