// portall/client/src/pages/SignupPage.jsx

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import toast from 'react-hot-toast'
import './SignupPage.css'

function SignupPage() {
  const { register, isLoading, error, isAuthenticated, clearError } = useAuth()
  const navigate = useNavigate()
  
  // État local pour les données du formulaire
  const [formData, setFormData] = useState({
    userType: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  
  // État pour les erreurs de validation côté client
  const [validationErrors, setValidationErrors] = useState({})
  
  // État pour gérer l'affichage du message de succès
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)

  // CORRECTION : useEffect pour redirection avec dépendances spécifiques et stables
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate]) // Dépendances spécifiques et stables

  // CORRECTION : useEffect pour nettoyer les erreurs seulement au montage
  useEffect(() => {
    clearError()
  }, []) // Array vide pour exécution unique au montage

  // CORRECTION : Stabilisation de handleChange avec useCallback
  // Cette fonction ne sera recréée que si validationErrors change vraiment
  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    
    // Mettre à jour les données du formulaire de manière immutable
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Nettoyer l'erreur de validation pour ce champ si elle existe
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }, [validationErrors]) // Cette fonction ne change que si validationErrors change

  // CORRECTION : Stabilisation de la fonction de validation
  // Cette fonction encapsule toute la logique de validation complexe
  const validateForm = useCallback(() => {
    const errors = {}
    
    // Validation du type d'utilisateur - premier critère obligatoire
    if (!formData.userType) {
      errors.userType = 'Please select your user type'
    }
    
    // Validation du prénom avec plusieurs critères de qualité
    if (!formData.firstName) {
      errors.firstName = 'First name is required'
    } else if (formData.firstName.length < 2) {
      errors.firstName = 'First name must be at least 2 characters'
    } else if (!/^[A-Za-z]+$/.test(formData.firstName)) {
      errors.firstName = 'First name must contain only letters'
    }
    
    // Validation du nom de famille avec les mêmes critères stricts
    if (!formData.lastName) {
      errors.lastName = 'Last name is required'
    } else if (formData.lastName.length < 2) {
      errors.lastName = 'Last name must be at least 2 characters'
    } else if (!/^[A-Za-z]+$/.test(formData.lastName)) {
      errors.lastName = 'Last name must contain only letters'
    }
    
    // Validation de l'email avec pattern strict
    if (!formData.email) {
      errors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }
    
    // Validation du mot de passe avec critères de sécurité robustes
    if (!formData.password) {
      errors.password = 'Password is required'
    } else {
      // Pattern pour mot de passe sécurisé : au moins une minuscule, une majuscule, un chiffre, et un caractère spécial
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      
      if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters long'
      } else if (!passwordRegex.test(formData.password)) {
        errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }
    }
    
    // Validation de la confirmation de mot de passe
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }
    
    // Appliquer les erreurs trouvées à l'état du composant
    setValidationErrors(errors)
    
    // Retourner true si aucune erreur n'a été trouvée
    return Object.keys(errors).length === 0
  }, [
    formData.userType,
    formData.firstName,
    formData.lastName,
    formData.email,
    formData.password,
    formData.confirmPassword
  ]) // Cette fonction ne change que si les données du formulaire changent vraiment

  // CORRECTION : Stabilisation de handleSubmit avec toutes ses dépendances explicites
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    
    // Nettoyer les états d'erreur précédents pour commencer sur une base propre
    clearError()
    setValidationErrors({})
    setShowSuccessMessage(false)
    
    // Valider le formulaire avant de tenter l'inscription
    if (!validateForm()) {
      toast.error('Please fix the errors in the form')
      return
    }
    
    try {
      // Tenter l'inscription avec les données validées
      const result = await register(formData)
      
      if (result.success) {
        // En cas de succès, afficher le message de succès et réinitialiser le formulaire
        setShowSuccessMessage(true)
        setFormData({
          userType: '',
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: ''
        })
        
        // Programmer une redirection vers la page de login après un délai
        // Cela donne le temps à l'utilisateur de lire le message de succès
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Account created successfully! Please wait for admin approval before logging in.' 
            }
          })
        }, 3000) // 3 secondes pour lire le message
      }
      // Si l'inscription échoue, les erreurs sont déjà gérées par le Context d'authentification
    } catch (error) {
      // Gérer les erreurs inattendues qui ne sont pas couvertes par le service d'authentification
      console.error('Unexpected registration error:', error)
      toast.error('An unexpected error occurred. Please try again.')
    }
  }, [
    formData,
    register,
    clearError,
    validateForm,
    navigate
  ]) // Toutes les dépendances sont explicitement listées

  // Rendu conditionnel : si l'inscription a réussi, afficher le message de succès
  if (showSuccessMessage) {
    return (
      <div className="signup-page">
        <div className="signup-container">
          <div className="signup-header">
            <h1>🎉 Account Created Successfully!</h1>
            <div style={{
              background: '#dcfce7',
              color: '#166534',
              padding: '20px',
              borderRadius: '8px',
              marginTop: '20px',
              textAlign: 'center'
            }}>
              <p style={{ marginBottom: '12px', fontWeight: '600' }}>
                Welcome to Portall!
              </p>
              <p style={{ marginBottom: '12px' }}>
                Your account has been created and is pending admin approval.
              </p>
              <p style={{ fontSize: '14px' }}>
                You will receive an email notification once your account is activated.
                Redirecting to login page in a few seconds...
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Rendu principal du formulaire d'inscription
  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="signup-header">
          <h1>Join Portall</h1>
          <p>Create your account to start your journey</p>
          
          {/* Affichage conditionnel des erreurs globales du Context */}
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
        
        <form onSubmit={handleSubmit} className="signup-form">
          {/* Sélection du type d'utilisateur avec feedback visuel */}
          <div className="form-group">
            <label>I am a:</label>
            <div className="radio-group">
              <label className={`radio-label ${formData.userType === 'player' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="userType"
                  value="player"
                  checked={formData.userType === 'player'}
                  onChange={handleChange}
                  disabled={isLoading}
                  required
                />
                <span>NJCAA Player</span>
              </label>
              <label className={`radio-label ${formData.userType === 'coach' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="userType"
                  value="coach"
                  checked={formData.userType === 'coach'}
                  onChange={handleChange}
                  disabled={isLoading}
                  required
                />
                <span>NCAA/NAIA Coach</span>
              </label>
            </div>
            {/* Affichage conditionnel de l'erreur de validation pour le type d'utilisateur */}
            {validationErrors.userType && (
              <span className="field-error" style={{
                color: '#dc2626',
                fontSize: '12px',
                marginTop: '4px',
                display: 'block'
              }}>
                {validationErrors.userType}
              </span>
            )}
          </div>
          
          {/* Ligne de champs pour prénom et nom - optimisation de l'espace */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                disabled={isLoading}
                className={validationErrors.firstName ? 'error' : ''}
                required
              />
              {validationErrors.firstName && (
                <span className="field-error" style={{
                  color: '#dc2626',
                  fontSize: '12px',
                  marginTop: '4px',
                  display: 'block'
                }}>
                  {validationErrors.firstName}
                </span>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                disabled={isLoading}
                className={validationErrors.lastName ? 'error' : ''}
                required
              />
              {validationErrors.lastName && (
                <span className="field-error" style={{
                  color: '#dc2626',
                  fontSize: '12px',
                  marginTop: '4px',
                  display: 'block'
                }}>
                  {validationErrors.lastName}
                </span>
              )}
            </div>
          </div>
          
          {/* Champ email avec validation stricte */}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
              className={validationErrors.email ? 'error' : ''}
              required
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
          
          {/* Champ mot de passe avec aide contextuelle */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
              className={validationErrors.password ? 'error' : ''}
              required
              minLength="8"
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
            {/* Aide contextuelle pour la création du mot de passe */}
            <small style={{ 
              fontSize: '12px', 
              color: '#6b7280', 
              display: 'block', 
              marginTop: '4px' 
            }}>
              Must contain: uppercase, lowercase, number, and special character
            </small>
          </div>
          
          {/* Confirmation du mot de passe */}
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={isLoading}
              className={validationErrors.confirmPassword ? 'error' : ''}
              required
            />
            {validationErrors.confirmPassword && (
              <span className="field-error" style={{
                color: '#dc2626',
                fontSize: '12px',
                marginTop: '4px',
                display: 'block'
              }}>
                {validationErrors.confirmPassword}
              </span>
            )}
          </div>
          
          {/* Bouton de soumission avec état de chargement interactif */}
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
                Creating Account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>
        
        {/* Navigation vers d'autres pages */}
        <div className="signup-footer">
          <p>Already have an account? <Link to="/login">Log in</Link></p>
          <Link to="/" className="back-link">← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}

export default SignupPage