// portall/client/src/contexts/AuthContext.jsx

import React, { createContext, useContext, useReducer, useEffect } from 'react'
import AuthService from '@services/authService'
import toast from 'react-hot-toast'

/**
 * 🔐 Context d'Authentification - Cœur de la gestion d'état utilisateur
 * 
 * Ce context gère l'état d'authentification global de l'application,
 * s'intégrant parfaitement avec votre système d'authentification backend.
 * 
 * 🎯 Responsabilités principales :
 * 1. Gestion de l'état de connexion (isAuthenticated, user, loading)
 * 2. Actions d'authentification (login, logout, register)
 * 3. Persistance automatique entre sessions
 * 4. Récupération automatique du profil au démarrage
 * 5. Gestion des erreurs avec feedback utilisateur
 */

// Création du context
const AuthContext = createContext()

// États possibles de l'authentification
const initialState = {
  isAuthenticated: false,
  user: null,
  isLoading: true, // true au démarrage pour vérifier l'auth existante
  error: null
}

/**
 * 🔄 Reducer pour la gestion d'état - Pattern Redux simplifié
 * 
 * Ce reducer gère toutes les transitions d'état liées à l'authentification
 * de manière prévisible et debuggable.
 */
const authReducer = (state, action) => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null
      }

    case 'AUTH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload.user,
        error: null
      }

    case 'AUTH_ERROR':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        error: action.payload
      }

    case 'AUTH_LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null
      }

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      }

    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      }

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      }

    default:
      return state
  }
}

/**
 * 🏠 Provider du Context - Composant racine de l'authentification
 */
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  /**
   * 🚀 Initialisation automatique - Vérification de l'authentification existante
   * 
   * Au démarrage de l'app, on vérifie s'il y a une session active
   * en validant le token stocké via votre endpoint /api/auth/me
   */
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🚀 Initializing authentication state...')
      
      if (AuthService.isAuthenticated()) {
        try {
          // Valider le token en récupérant le profil utilisateur
          const result = await AuthService.getCurrentUser()
          
          if (result.success) {
            dispatch({
              type: 'AUTH_SUCCESS',
              payload: { user: result.user }
            })
            console.log(`✅ User authenticated: ${result.user.email} (${result.user.userType})`)
          } else {
            // Token invalide, nettoyer
            await AuthService.logout()
            dispatch({ type: 'AUTH_ERROR', payload: 'Session expired' })
          }
        } catch (error) {
          console.error('❌ Auth initialization failed:', error)
          await AuthService.logout()
          dispatch({ type: 'AUTH_ERROR', payload: 'Authentication failed' })
        }
      } else {
        // Pas d'authentification trouvée
        dispatch({ type: 'SET_LOADING', payload: false })
        console.log('ℹ️ No existing authentication found')
      }
    }

    initializeAuth()
  }, [])

  /**
   * 🔑 Fonction de connexion
   */
  const login = async (email, password) => {
    dispatch({ type: 'AUTH_START' })

    try {
      const result = await AuthService.login(email, password)

      if (result.success) {
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user: result.user }
        })

        toast.success(`Welcome back, ${result.user.firstName}!`)
        console.log(`✅ Login successful for: ${result.user.email}`)

        return { success: true, user: result.user }
      } else {
        dispatch({
          type: 'AUTH_ERROR',
          payload: result.message
        })

        return { success: false, message: result.message }
      }
    } catch (error) {
      const errorMessage = 'Login failed. Please try again.'
      dispatch({
        type: 'AUTH_ERROR',
        payload: errorMessage
      })

      return { success: false, message: errorMessage }
    }
  }

  /**
   * 📝 Fonction d'inscription
   */
  const register = async (userData) => {
    dispatch({ type: 'AUTH_START' })

    try {
      const result = await AuthService.register(userData)

      if (result.success) {
        // Si l'inscription inclut une connexion automatique
        if (result.tokens) {
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: { user: result.user }
          })
          toast.success(`Account created successfully! Welcome ${result.user.firstName}!`)
        } else {
          // Inscription réussie mais nécessite validation admin
          dispatch({ type: 'SET_LOADING', payload: false })
          toast.success('Account created! Please wait for admin approval.')
        }

        return { success: true, user: result.user, message: result.message }
      } else {
        dispatch({
          type: 'AUTH_ERROR',
          payload: result.message
        })

        return { 
          success: false, 
          message: result.message,
          errors: result.errors 
        }
      }
    } catch (error) {
      const errorMessage = 'Registration failed. Please try again.'
      dispatch({
        type: 'AUTH_ERROR',
        payload: errorMessage
      })

      return { success: false, message: errorMessage }
    }
  }

  /**
   * 🚪 Fonction de déconnexion
   */
  const logout = async () => {
    try {
      await AuthService.logout()
      dispatch({ type: 'AUTH_LOGOUT' })
      toast.success('Logged out successfully')
      console.log('✅ Logout completed')
    } catch (error) {
      console.error('❌ Logout error:', error)
      // Même en cas d'erreur, on force le logout local
      dispatch({ type: 'AUTH_LOGOUT' })
    }
  }

  /**
   * 🔄 Fonction de mise à jour du profil utilisateur
   */
  const updateUser = (userData) => {
    dispatch({
      type: 'UPDATE_USER',
      payload: userData
    })
  }

  /**
   * 🧹 Fonction pour effacer les erreurs
   */
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' })
  }

  /**
   * 📊 Valeurs exposées par le context
   */
  const value = {
    // État
    ...state,
    
    // Actions
    login,
    register,
    logout,
    updateUser,
    clearError,
    
    // Utilitaires
    isLoading: state.isLoading,
    hasError: !!state.error
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * 🎣 Hook personnalisé pour utiliser le context d'authentification
 * 
 * Ce hook simplifie l'accès au context et ajoute une validation
 * pour s'assurer qu'il est utilisé dans le bon Provider.
 */
export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

export default AuthContext