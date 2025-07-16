// portall/client/src/services/api.js

import axios from 'axios'
import toast from 'react-hot-toast'

/**
 * 🔗 Configuration API centrale - Cœur de la communication Frontend/Backend
 * 
 * Ce service est conçu pour s'intégrer parfaitement avec votre architecture
 * backend Portall. Chaque méthode respecte exactement le format de réponse
 * standardisé de votre API.
 * 
 * 🎯 Principes d'architecture :
 * 1. Intercepteurs automatiques pour les tokens JWT
 * 2. Gestion centralisée des erreurs avec feedback utilisateur
 * 3. Refresh automatique des tokens expirés
 * 4. Logging détaillé pour le développement
 */

// Configuration de base d'Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// État des tokens en mémoire pour éviter les fuites localStorage
let authTokens = {
  accessToken: null,
  refreshToken: null
}

/**
 * 🔐 Gestion intelligente des tokens
 * 
 * Ces fonctions gèrent le cycle de vie des tokens JWT en synchronisation
 * parfaite avec votre système d'authentification backend.
 */
export const setTokens = (accessToken, refreshToken) => {
  authTokens.accessToken = accessToken
  authTokens.refreshToken = refreshToken
  
  // Stocker dans localStorage pour persistance entre sessions
  if (accessToken) {
    localStorage.setItem('accessToken', accessToken)
  }
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken)
  }
  
  console.log('🔐 Tokens updated and stored')
}

export const getTokens = () => {
  // Récupérer depuis la mémoire ou localStorage si nécessaire
  if (!authTokens.accessToken) {
    authTokens.accessToken = localStorage.getItem('accessToken')
    authTokens.refreshToken = localStorage.getItem('refreshToken')
  }
  
  return authTokens
}

export const removeTokens = () => {
  authTokens.accessToken = null
  authTokens.refreshToken = null
  
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  
  console.log('🔓 Tokens cleared')
}

/**
 * 🚀 Intercepteur de requête - Injection automatique du token
 * 
 * Cet intercepteur ajoute automatiquement le token JWT à chaque requête,
 * reproduisant fidèlement ce que votre middleware backend attend.
 */
api.interceptors.request.use(
  (config) => {
    const { accessToken } = getTokens()
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    
    // ✅ AMÉLIORATION : Logging détaillé pour le débogage
    console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`)
    console.log('📋 Request config:', {
      url: config.url,
      method: config.method,
      baseURL: config.baseURL,
      headers: config.headers
    })
    
    return config
  },
  (error) => {
    console.error('❌ Request interceptor error:', error)
    return Promise.reject(error)
  }
)

/**
 * 🔄 Intercepteur de réponse - Gestion du refresh automatique
 * 
 * Cette logique reproduit exactement le workflow de votre backend :
 * 1. Si token expiré (401), essayer le refresh automatiquement
 * 2. Si refresh réussit, retry la requête originale
 * 3. Si refresh échoue, rediriger vers login
 */
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`)
    return response
  },
  async (error) => {
    console.error('❌ API Error Details:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      baseURL: error.config?.baseURL
    })

    // ✅ AMÉLIORATION : Diagnostic spécifique selon le type d'erreur
    if (error.code === 'ECONNREFUSED') {
      console.error('🚨 CONNECTION REFUSED: Backend server is not running or wrong port')
      toast.error('Cannot connect to server. Please check if backend is running.')
      return Promise.reject({
        ...error,
        message: 'Backend server is not running. Please start the server and try again.'
      })
    }

    if (error.code === 'NETWORK_ERROR' || !error.response) {
      console.error('🚨 NETWORK ERROR: Cannot reach backend server')
      toast.error('Network error. Please check your connection and server.')
      return Promise.reject({
        ...error,
        message: 'Network error. Please check if the backend server is running.'
      })
    }

    const originalRequest = error.config
    
    // Gestion du token expiré (401)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      const { refreshToken } = getTokens()
      
      if (refreshToken) {
        try {
          console.log('🔄 Access token expired, attempting refresh...')
          
          const refreshResponse = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken }
          )
          
          const { tokens } = refreshResponse.data.data
          setTokens(tokens.accessToken, tokens.refreshToken)
          
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`
          
          console.log('✅ Token refreshed successfully')
          return api(originalRequest)
          
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError)
          removeTokens()
          toast.error('Session expired. Please login again.')
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      } else {
        removeTokens()
        window.location.href = '/login'
      }
    }
    
    // Gestion des autres erreurs avec messages utilisateur amicaux
    const errorMessage = error.response?.data?.message || error.message || 'An unexpected error occurred'
    
    if (!originalRequest.silent) {
      toast.error(errorMessage)
    }
    
    return Promise.reject(error)
  }
)

export default api