// portall/client/src/pages/LoginPage.jsx

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import toast from 'react-hot-toast'
import './LoginPage.css'

function LoginPage() {
  const { login, isLoading, error, isAuthenticated, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  
  const [validationErrors, setValidationErrors] = useState({})

  // CORRECTION : useEffect avec dépendances spécifiques et logique de redirection améliorée
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location.state?.from?.pathname]) // Dépendances spécifiques

  // CORRECTION : useEffect pour nettoyer les erreurs seulement au montage
  useEffect(() => {
    clearError()
  }, []) // Array vide car nous voulons que cela ne s'exécute qu'au montage

  // CORRECTION : useCallback pour stabiliser la fonction de changement
  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }, [validationErrors]) // Dépend de validationErrors

  const validateForm = useCallback(() => {
    const errors = {}
    
    if (!formData.email) {
      errors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }
    
    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [formData.email, formData.password]) // Dépend des données du formulaire

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    
    clearError()
    setValidationErrors({})
    
    if (!validateForm()) {
      toast.error('Please fix the errors in the form')
      return
    }
    
    try {
      const result = await login(formData.email, formData.password)
      
      if (result.success) {
        console.log('✅ Login successful, redirecting...')
      } else {
        console.log('❌ Login failed:', result.message)
        
        if (result.code === 'ACCOUNT_NOT_ACTIVE') {
          toast('Please check your email and wait for admin approval', {
            icon: '⏳',
            duration: 6000
          })
        }
      }
    } catch (error) {
      console.error('Unexpected login error:', error)
      toast.error('An unexpected error occurred. Please try again.')
    }
  }, [formData.email, formData.password, login, clearError, validateForm])

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Welcome Back</h1>
          <p>Log in to access your Portall account</p>
          
          {error && (
            <div className="error-message" style={{
              background: '#fee2e2',
              color: '#dc2626',
              padding: '12px',
              borderRadius: '6px',
              marginTop: '16px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
              disabled={isLoading}
              className={validationErrors.email ? 'error' : ''}
            />
            {validationErrors.email && (
              <span className="field-error" style={{
                color: '#dc2626',
                fontSize: '12px',
                marginTop: '4px',
                display: 'block'
              }}>
                {validationErrors.email}
              </span>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
              disabled={isLoading}
              className={validationErrors.password ? 'error' : ''}
            />
            {validationErrors.password && (
              <span className="field-error" style={{
                color: '#dc2626',
                fontSize: '12px',
                marginTop: '4px',
                display: 'block'
              }}>
                {validationErrors.password}
              </span>
            )}
          </div>
          
          <button 
            type="submit" 
            className={`btn btn-primary btn-full ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{
                  marginRight: '8px',
                  animation: 'spin 1s linear infinite',
                  display: 'inline-block'
                }}>⚪</span>
                Signing in...
              </span>
            ) : (
              'Log In'
            )}
          </button>
        </form>
        
        <div className="login-footer">
          <p>Don't have an account? <Link to="/signup">Sign up</Link></p>
          <Link to="/" className="back-link">← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}

export default LoginPage