// client/src/pages/auth/LoginPage.jsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import toast from 'react-hot-toast'

/**
 * 🔑 Page de Connexion - Interface utilisateur pour l'authentification
 * 
 * Cette page reproduit exactement le workflow de votre endpoint POST /api/auth/login.
 * Elle gère la validation côté client, les erreurs d'API, et la redirection
 * post-connexion vers le dashboard approprié.
 * 
 * 🎯 Workflow utilisateur :
 * 1. Saisie email/password avec validation en temps réel
 * 2. Soumission -> Appel API /auth/login
 * 3. Succès -> Redirection vers dashboard selon userType
 * 4. Erreur -> Affichage message d'erreur avec suggestions
 */
const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading, error, clearError } = useAuth()

  // État du formulaire
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  
  // État de validation
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Récupération de l'URL de redirection post-login
  const from = location.state?.from || '/dashboard'

  /**
   * 🧹 Nettoyage des erreurs au démontage du composant
   */
  useEffect(() => {
    return () => {
      clearError()
    }
  }, [clearError])

  /**
   * 📝 Gestion des changements de formulaire avec validation temps réel
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Effacer l'erreur du champ modifié
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }

    // Effacer l'erreur globale si l'utilisateur corrige sa saisie
    if (error) {
      clearError()
    }
  }

  /**
   * ✅ Validation côté client avant soumission
   * 
   * Cette validation préliminaire améliore l'UX en évitant des appels API
   * inutiles, mais ne remplace pas la validation backend qui reste autoritaire.
   */
  const validateForm = () => {
    const errors = {}

    // Validation email
    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    // Validation password
    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  /**
   * 🚀 Soumission du formulaire - Appel à votre API backend
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation côté client
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      console.log(`🔑 Attempting login for: ${formData.email}`)
      
      const result = await login(formData.email, formData.password)

      if (result.success) {
        console.log(`✅ Login successful, redirecting to: ${from}`)
        
        // Redirection vers la page demandée ou dashboard par défaut
        navigate(from, { replace: true })
      } else {
        // L'erreur est déjà gérée par le AuthContext et affichée via toast
        console.log(`❌ Login failed: ${result.message}`)
      }
    } catch (error) {
      console.error('❌ Login error:', error)
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          {/* En-tête de la page */}
          <div className="auth-header">
            <h1>Welcome Back to Portall</h1>
            <p>Sign in to access your personalized dashboard</p>
          </div>

          {/* Formulaire de connexion */}
          <form onSubmit={handleSubmit} className="auth-form">
            {/* Champ Email */}
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`form-input ${formErrors.email ? 'error' : ''}`}
                placeholder="Enter your email"
                autoComplete="email"
                disabled={isSubmitting}
              />
              {formErrors.email && (
                <span className="error-message">{formErrors.email}</span>
              )}
            </div>

            {/* Champ Password */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`form-input ${formErrors.password ? 'error' : ''}`}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              {formErrors.password && (
                <span className="error-message">{formErrors.password}</span>
              )}
            </div>

            {/* Affichage des erreurs globales */}
            {error && (
              <div className="error-banner">
                <p>{error}</p>
              </div>
            )}

            {/* Bouton de soumission */}
            <button
              type="submit"
              className={`auth-button ${isSubmitting ? 'loading' : ''}`}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Liens utiles */}
          <div className="auth-links">
            <Link to="/forgot-password" className="link">
              Forgot your password?
            </Link>
            
            <div className="auth-redirect">
              <span>Don't have an account? </span>
              <Link to="/register" className="link-primary">
                Sign up here
              </Link>
            </div>
            
            <div className="auth-redirect">
              <Link to="/" className="link">
                ← Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage