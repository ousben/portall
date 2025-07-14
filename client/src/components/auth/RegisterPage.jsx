// client/src/pages/auth/RegisterPage.jsx
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import toast from 'react-hot-toast'

/**
 * 📝 Page d'Inscription - Formulaire adaptatif selon le type d'utilisateur
 * 
 * Cette page reproduit exactement la logique de votre endpoint POST /api/auth/register
 * avec validation conditionnelle selon le userType. Le formulaire s'adapte
 * dynamiquement pour afficher les champs appropriés à chaque type d'utilisateur.
 * 
 * 🎯 Concept pédagogique : Formulaire polymorphe
 * Comme votre backend gère différents types d'utilisateurs avec des validations
 * spécifiques, cette page adapte son interface selon le type sélectionné.
 */
const RegisterPage = () => {
  const navigate = useNavigate()
  const { register, isLoading, clearError } = useAuth()

  // État du formulaire avec tous les champs possibles
  const [formData, setFormData] = useState({
    // Champs communs à tous les types
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    userType: '', // Détermine quels champs afficher
    
    // Champs spécifiques aux joueurs
    dateOfBirth: '',
    height: '',
    weight: '',
    position: '',
    gender: '',
    collegeId: '',
    currentYear: '',
    graduationYear: '',
    
    // Champs spécifiques aux coachs NCAA/NAIA
    coachPosition: '',
    coachPhoneNumber: '',
    coachCollegeId: '',
    coachDivision: '',
    coachTeamSport: '',
    
    // Champs spécifiques aux coachs NJCAA
    njcaaPosition: '',
    njcaaPhoneNumber: '',
    njcaaCollegeId: '',
    njcaaDivision: '',
    njcaaTeamSport: ''
  })

  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState(1) // Pour formulaire multi-étapes

  /**
   * 🧹 Nettoyage des erreurs au démontage
   */
  useEffect(() => {
    return () => {
      clearError()
    }
  }, [clearError])

  /**
   * 📝 Gestion des changements avec réinitialisation des champs spécifiques
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value }
      
      // Si changement de userType, réinitialiser les champs spécifiques
      if (name === 'userType') {
        // Garder seulement les champs communs
        Object.keys(newData).forEach(key => {
          if (!['email', 'password', 'confirmPassword', 'firstName', 'lastName', 'userType'].includes(key)) {
            newData[key] = ''
          }
        })
      }
      
      return newData
    })

    // Effacer l'erreur du champ modifié
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  /**
   * ✅ Validation adaptative selon le type d'utilisateur
   * 
   * Cette fonction reproduit côté client la même logique de validation
   * conditionnelle que votre middleware backend validateRegistration.
   */
  const validateForm = () => {
    const errors = {}

    // Validation des champs communs
    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required'
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required'
    }

    if (!formData.userType) {
      errors.userType = 'Please select your user type'
    }

    // Validation spécifique selon le type d'utilisateur
    if (formData.userType === 'player') {
      if (!formData.dateOfBirth) errors.dateOfBirth = 'Date of birth is required'
      if (!formData.height) errors.height = 'Height is required'
      if (!formData.weight) errors.weight = 'Weight is required'
      if (!formData.position) errors.position = 'Position is required'
      if (!formData.gender) errors.gender = 'Gender is required'
      if (!formData.collegeId) errors.collegeId = 'College selection is required'
      if (!formData.currentYear) errors.currentYear = 'Current year is required'
      if (!formData.graduationYear) errors.graduationYear = 'Graduation year is required'
    }

    if (formData.userType === 'coach') {
      if (!formData.coachPosition) errors.coachPosition = 'Position is required'
      if (!formData.coachPhoneNumber) errors.coachPhoneNumber = 'Phone number is required'
      if (!formData.coachCollegeId) errors.coachCollegeId = 'College selection is required'
      if (!formData.coachDivision) errors.coachDivision = 'Division is required'
      if (!formData.coachTeamSport) errors.coachTeamSport = 'Team sport is required'
    }

    if (formData.userType === 'njcaa_coach') {
      if (!formData.njcaaPosition) errors.njcaaPosition = 'Position is required'
      if (!formData.njcaaPhoneNumber) errors.njcaaPhoneNumber = 'Phone number is required'
      if (!formData.njcaaCollegeId) errors.njcaaCollegeId = 'College selection is required'
      if (!formData.njcaaDivision) errors.njcaaDivision = 'Division is required'
      if (!formData.njcaaTeamSport) errors.njcaaTeamSport = 'Team sport is required'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  /**
   * 🚀 Préparation des données pour l'API selon le format backend
   */
  const prepareRegistrationData = () => {
    const baseData = {
      email: formData.email.trim(),
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      userType: formData.userType
    }

    // Ajouter les champs spécifiques selon le type
    if (formData.userType === 'player') {
      return {
        ...baseData,
        dateOfBirth: formData.dateOfBirth,
        height: parseInt(formData.height),
        weight: parseInt(formData.weight),
        position: formData.position,
        gender: formData.gender,
        collegeId: parseInt(formData.collegeId),
        currentYear: formData.currentYear,
        graduationYear: parseInt(formData.graduationYear)
      }
    }

    if (formData.userType === 'coach') {
      return {
        ...baseData,
        position: formData.coachPosition,
        phoneNumber: formData.coachPhoneNumber,
        collegeId: parseInt(formData.coachCollegeId),
        division: formData.coachDivision,
        teamSport: formData.coachTeamSport
      }
    }

    if (formData.userType === 'njcaa_coach') {
      return {
        ...baseData,
        position: formData.njcaaPosition,
        phoneNumber: formData.njcaaPhoneNumber,
        collegeId: parseInt(formData.njcaaCollegeId),
        division: formData.njcaaDivision,
        teamSport: formData.njcaaTeamSport
      }
    }

    return baseData
  }

  /**
   * 🚀 Soumission du formulaire
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Please correct the errors before submitting')
      return
    }

    setIsSubmitting(true)

    try {
      const registrationData = prepareRegistrationData()
      console.log(`📝 Attempting registration for ${formData.userType}: ${formData.email}`)
      
      const result = await register(registrationData)

      if (result.success) {
        if (result.user && result.tokens) {
          // Auto-login après inscription
          toast.success('Account created successfully! Welcome to Portall!')
          navigate('/dashboard')
        } else {
          // Inscription réussie mais nécessite validation admin
          toast.success('Account created! Please wait for admin approval.')
          navigate('/login')
        }
      } else {
        // Affichage des erreurs spécifiques
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach(error => {
            toast.error(error.message)
          })
        } else {
          toast.error(result.message || 'Registration failed')
        }
      }
    } catch (error) {
      console.error('❌ Registration error:', error)
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * 🎨 Rendu des champs spécifiques selon le type d'utilisateur
   */
  const renderTypeSpecificFields = () => {
    if (!formData.userType) return null

    if (formData.userType === 'player') {
      return (
        <div className="form-section">
          <h3>Player Information</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dateOfBirth">Date of Birth</label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                className={`form-input ${formErrors.dateOfBirth ? 'error' : ''}`}
                disabled={isSubmitting}
              />
              {formErrors.dateOfBirth && (
                <span className="error-message">{formErrors.dateOfBirth}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                className={`form-input ${formErrors.gender ? 'error' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {formErrors.gender && (
                <span className="error-message">{formErrors.gender}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="height">Height (cm)</label>
              <input
                type="number"
                id="height"
                name="height"
                value={formData.height}
                onChange={handleInputChange}
                className={`form-input ${formErrors.height ? 'error' : ''}`}
                placeholder="175"
                min="150"
                max="220"
                disabled={isSubmitting}
              />
              {formErrors.height && (
                <span className="error-message">{formErrors.height}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="weight">Weight (kg)</label>
              <input
                type="number"
                id="weight"
                name="weight"
                value={formData.weight}
                onChange={handleInputChange}
                className={`form-input ${formErrors.weight ? 'error' : ''}`}
                placeholder="70"
                min="45"
                max="150"
                disabled={isSubmitting}
              />
              {formErrors.weight && (
                <span className="error-message">{formErrors.weight}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="position">Playing Position</label>
            <select
              id="position"
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              className={`form-input ${formErrors.position ? 'error' : ''}`}
              disabled={isSubmitting}
            >
              <option value="">Select position</option>
              <option value="goalkeeper">Goalkeeper</option>
              <option value="defender">Defender</option>
              <option value="midfielder">Midfielder</option>
              <option value="forward">Forward</option>
            </select>
            {formErrors.position && (
              <span className="error-message">{formErrors.position}</span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="currentYear">Current Year</label>
              <select
                id="currentYear"
                name="currentYear"
                value={formData.currentYear}
                onChange={handleInputChange}
                className={`form-input ${formErrors.currentYear ? 'error' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Select year</option>
                <option value="freshman">Freshman</option>
                <option value="sophomore">Sophomore</option>
              </select>
              {formErrors.currentYear && (
                <span className="error-message">{formErrors.currentYear}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="graduationYear">Graduation Year</label>
              <input
                type="number"
                id="graduationYear"
                name="graduationYear"
                value={formData.graduationYear}
                onChange={handleInputChange}
                className={`form-input ${formErrors.graduationYear ? 'error' : ''}`}
                placeholder="2025"
                min="2024"
                max="2030"
                disabled={isSubmitting}
              />
              {formErrors.graduationYear && (
                <span className="error-message">{formErrors.graduationYear}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="collegeId">NJCAA College</label>
            <select
              id="collegeId"
              name="collegeId"
              value={formData.collegeId}
              onChange={handleInputChange}
              className={`form-input ${formErrors.collegeId ? 'error' : ''}`}
              disabled={isSubmitting}
            >
              <option value="">Select your college</option>
              {/* Ces options seront peuplées dynamiquement depuis votre API /reference/njcaa-colleges */}
              <option value="1">Sample NJCAA College 1</option>
              <option value="2">Sample NJCAA College 2</option>
            </select>
            {formErrors.collegeId && (
              <span className="error-message">{formErrors.collegeId}</span>
            )}
          </div>
        </div>
      )
    }

    // Champs similaires pour coach et njcaa_coach...
    // (Implémentation similaire mais avec les champs appropriés)

    return null
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card register-card">
          <div className="auth-header">
            <h1>Join Portall</h1>
            <p>Create your account and start connecting with opportunities</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form register-form">
            {/* Étape 1: Informations de base */}
            <div className="form-section">
              <h3>Basic Information</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className={`form-input ${formErrors.firstName ? 'error' : ''}`}
                    placeholder="Enter your first name"
                    disabled={isSubmitting}
                  />
                  {formErrors.firstName && (
                    <span className="error-message">{formErrors.firstName}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className={`form-input ${formErrors.lastName ? 'error' : ''}`}
                    placeholder="Enter your last name"
                    disabled={isSubmitting}
                  />
                  {formErrors.lastName && (
                    <span className="error-message">{formErrors.lastName}</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
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

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`form-input ${formErrors.password ? 'error' : ''}`}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  {formErrors.password && (
                    <span className="error-message">{formErrors.password}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`form-input ${formErrors.confirmPassword ? 'error' : ''}`}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  {formErrors.confirmPassword && (
                    <span className="error-message">{formErrors.confirmPassword}</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="userType">I am a...</label>
                <select
                  id="userType"
                  name="userType"
                  value={formData.userType}
                  onChange={handleInputChange}
                  className={`form-input ${formErrors.userType ? 'error' : ''}`}
                  disabled={isSubmitting}
                >
                  <option value="">Select your role</option>
                  <option value="player">NJCAA Player</option>
                  <option value="coach">NCAA/NAIA Coach</option>
                  <option value="njcaa_coach">NJCAA Coach</option>
                </select>
                {formErrors.userType && (
                  <span className="error-message">{formErrors.userType}</span>
                )}
              </div>
            </div>

            {/* Champs spécifiques selon le type */}
            {renderTypeSpecificFields()}

            {/* Bouton de soumission */}
            <button
              type="submit"
              className={`auth-button ${isSubmitting ? 'loading' : ''}`}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Liens utiles */}
          <div className="auth-links">
            <div className="auth-redirect">
              <span>Already have an account? </span>
              <Link to="/login" className="link-primary">
                Sign in here
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

export default RegisterPage