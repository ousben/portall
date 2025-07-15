// portall/client/src/contexts/AuthContext.jsx

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import AuthService from '@services/authService'
import toast from 'react-hot-toast'

/**
 * 🔐 Context d'Authentification - Version Corrigée et Stabilisée
 * 
 * Cette version corrige tous les problèmes de boucles infinies en :
 * 1. Mémorisant toutes les fonctions avec useCallback
 * 2. Stabilisant les dépendances des useEffect
 * 3. Évitant les re-créations inutiles d'objets et fonctions
 * 
 * 🎯 Principe clé : Stabilité référentielle
 * En React, si une fonction change de référence à chaque rendu,
 * tous les composants qui en dépendent vont se re-rendre.
 */

const AuthContext = createContext()

const initialState = {
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null
}

/**
 * 🔄 Reducer stable - Aucune fonction ici, donc aucun problème de référence
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
 * 🏠 Provider Corrigé - Toutes les fonctions sont mémorisées
 */
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  /**
   * 🚀 Initialisation stabilisée - useEffect avec dépendances vides
   * 
   * Cette fonction ne doit s'exécuter qu'UNE SEULE FOIS au montage du composant.
   * Aucune dépendance = exécution unique = pas de boucle.
   */
  useEffect(() => {
    let isMounted = true // Flag pour éviter les updates sur composant démonté

    const initializeAuth = async () => {
      console.log('🚀 Initializing authentication state...')
      
      if (AuthService.isAuthenticated()) {
        try {
          const result = await AuthService.getCurrentUser()
          
          // Vérifier que le composant est toujours monté avant de mettre à jour l'état
          if (isMounted) {
            if (result.success) {
              dispatch({
                type: 'AUTH_SUCCESS',
                payload: { user: result.user }
              })
              console.log(`✅ User authenticated: ${result.user.email} (${result.user.userType})`)
            } else {
              await AuthService.logout()
              dispatch({ type: 'AUTH_ERROR', payload: 'Session expired' })
            }
          }
        } catch (error) {
          console.error('❌ Auth initialization failed:', error)
          if (isMounted) {
            await AuthService.logout()
            dispatch({ type: 'AUTH_ERROR', payload: 'Authentication failed' })
          }
        }
      } else {
        if (isMounted) {
          dispatch({ type: 'SET_LOADING', payload: false })
          console.log('ℹ️ No existing authentication found')
        }
      }
    }

    initializeAuth()

    // Cleanup function pour éviter les memory leaks
    return () => {
      isMounted = false
    }
  }, []) // ✅ Tableau vide = exécution unique

  /**
   * 🔑 Fonction de connexion mémorisée
   * 
   * useCallback garantit que cette fonction garde la même référence
   * tant que ses dépendances ne changent pas.
   */
  const login = useCallback(async (email, password) => {
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
  }, []) // ✅ Pas de dépendances = fonction stable

  /**
   * 📝 Fonction d'inscription mémorisée
   */
  const register = useCallback(async (userData) => {
    dispatch({ type: 'AUTH_START' })

    try {
      const result = await AuthService.register(userData)

      if (result.success) {
        if (result.tokens) {
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: { user: result.user }
          })
          toast.success(`Account created successfully! Welcome ${result.user.firstName}!`)
        } else {
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
  }, []) // ✅ Fonction stable

  /**
   * 🚪 Fonction de déconnexion mémorisée
   */
  const logout = useCallback(async () => {
    try {
      await AuthService.logout()
      dispatch({ type: 'AUTH_LOGOUT' })
      toast.success('Logged out successfully')
      console.log('✅ Logout completed')
    } catch (error) {
      console.error('❌ Logout error:', error)
      dispatch({ type: 'AUTH_LOGOUT' })
    }
  }, []) // ✅ Fonction stable

  /**
   * 🔄 Fonction de mise à jour utilisateur mémorisée
   */
  const updateUser = useCallback((userData) => {
    dispatch({
      type: 'UPDATE_USER',
      payload: userData
    })
  }, []) // ✅ Fonction stable

  /**
   * 🧹 Fonction de nettoyage d'erreur mémorisée
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
  }, []) // ✅ Fonction stable

  /**
   * 📊 Valeur du contexte mémorisée
   * 
   * useMemo évite que l'objet value soit recréé à chaque rendu,
   * ce qui éviterait de déclencher des re-rendus dans tous les composants enfants.
   */
  const value = React.useMemo(() => ({
    // État
    ...state,
    
    // Actions (toutes mémorisées)
    login,
    register,
    logout,
    updateUser,
    clearError,
    
    // Utilitaires
    hasError: !!state.error
  }), [
    state, 
    login, 
    register, 
    logout, 
    updateUser, 
    clearError
  ]) // ✅ Dépendances explicites et stables

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * 🎣 Hook d'utilisation du contexte
 */
export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

export default AuthContext