// client/src/pages/auth/LoginPage.jsx

import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import toast from 'react-hot-toast'

/**
 * 🔑 Page de Connexion - Version Corrigée Sans Boucles Infinies
 * 
 * Cette version corrige tous les problèmes de dépendances instables
 * en utilisant des patterns React optimisés.
 */
const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading, error, clearError } = useAuth()

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const from = location.state?.from || '/dashboard'

  /**
   * ✅ useEffect stable - Exécution unique au montage
   * 
   * Plus de dépendance sur clearError qui changeait à chaque rendu.
   * Cette fonction ne s'exécute qu'une seule fois au montage.
   */
  useEffect(() => {
    clearError()
  }, [clearError]) // ✅ clearError est maintenant stable grâce à useCallback

  /**
   * 📝 Gestion des changements stabilisée
   */
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Effacer l'erreur du champ modifié
    setFormErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      }
      return prev
    })

    // Effacer l'erreur globale si présente
    if (error) {
      clearError()
    }
  }, [error, clearError]) // ✅ Dépendances stables

  /**
   * ✅ Validation stabilisée
   */
  const validateForm = useCallback(() => {
    const errors = {}

    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [formData.email, formData.password]) // ✅ Dépendances explicites

  /**
   * 🚀 Soumission stabilisée
   */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      console.log(`🔑 Attempting login for: ${formData.email}`)
      
      const result = await login(formData.email, formData.password)

      if (result.success) {
        console.log(`✅ Login successful, redirecting to: ${from}`)
        navigate(from, { replace: true })
      } else {
        console.log(`❌ Login failed: ${result.message}`)
      }
    } catch (error) {
      console.error('❌ Login error:', error)
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [formData.email, formData.password, validateForm, login, from, navigate]) // ✅ Toutes dépendances stables

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Welcome Back to Portall</h1>
            <p>Sign in to access your personalized dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
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

            {error && (
              <div className="error-banner">
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              className={`auth-button ${isSubmitting ? 'loading' : ''}`}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

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