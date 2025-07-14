// portall/client/src/pages/auth/ResetPasswordPage.jsx

import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import AuthService from '@services/authService'
import toast from 'react-hot-toast'

/**
 * 🔐 Page de Reset Password - Finalisation Sécurisée du Workflow
 * 
 * Cette page complète le cycle de récupération de mot de passe en utilisant
 * le token sécurisé généré par votre backend. Elle valide le token et permet
 * à l'utilisateur de définir un nouveau mot de passe.
 */
const ResetPasswordPage = () => {
  const { token } = useParams()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidToken, setIsValidToken] = useState(null) // null = checking, true/false = result

  // Validation du token au chargement de la page
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValidToken(false)
        return
      }

      try {
        // Ici, vous pourriez ajouter un endpoint pour valider le token
        // Pour l'instant, nous assumons que le token est valide s'il existe
        setIsValidToken(true)
      } catch (error) {
        console.error('Token validation failed:', error)
        setIsValidToken(false)
      }
    }

    validateToken()
  }, [token])

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
  }

  const validateForm = () => {
    const errors = {}

    if (!formData.newPassword) {
      errors.newPassword = 'New password is required'
    } else if (formData.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters'
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password'
    } else if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await AuthService.resetPassword(token, formData.newPassword)

      if (result.success) {
        toast.success('Password reset successfully! You can now sign in.')
        navigate('/login')
      } else {
        toast.error(result.message || 'Failed to reset password')
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach(error => {
            toast.error(error.message)
          })
        }
      }
    } catch (error) {
      console.error('Reset password error:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // État de chargement pendant la validation du token
  if (isValidToken === null) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card">
            <div className="loading-spinner">
              <div className="spinner spinner-medium">
                <div className="spinner-circle"></div>
              </div>
              <p className="loading-message">Validating reset link...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Token invalide ou expiré
  if (isValidToken === false) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <h1>Invalid Reset Link</h1>
              <p>This password reset link is invalid or has expired.</p>
            </div>

            <div className="error-banner">
              <p>
                Reset links expire after 1 hour for security reasons. 
                Please request a new password reset if needed.
              </p>
            </div>

            <div className="auth-links">
              <Link to="/forgot-password" className="auth-button">
                Request New Reset Link
              </Link>
              <Link to="/login" className="link">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Formulaire de reset (token valide)
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Create New Password</h1>
            <p>Enter your new password below</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="newPassword" className="form-label">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                className={`form-input ${formErrors.newPassword ? 'error' : ''}`}
                placeholder="Enter your new password"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              {formErrors.newPassword && (
                <span className="error-message">{formErrors.newPassword}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`form-input ${formErrors.confirmPassword ? 'error' : ''}`}
                placeholder="Confirm your new password"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              {formErrors.confirmPassword && (
                <span className="error-message">{formErrors.confirmPassword}</span>
              )}
            </div>

            <button
              type="submit"
              className={`auth-button ${isSubmitting ? 'loading' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>

          <div className="auth-links">
            <Link to="/login" className="link">
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage