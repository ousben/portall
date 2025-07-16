// portall/client/src/pages/auth/RegisterPage.jsx

import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import toast from 'react-hot-toast'

/**
 * 📝 Page d'Inscription Complète - Tous Types d'Utilisateurs
 * 
 * Cette version implémente le formulaire complet avec tous les champs
 * requis par votre validation backend pour chaque type d'utilisateur.
 * 
 * 🎯 Fonctionnalités :
 * - Champs adaptatifs selon le userType sélectionné
 * - Validation côté client cohérente avec le backend
 * - Gestion des erreurs avec feedback spécifique
 * - Interface responsive et accessible
 */
const RegisterPage = () => {
  const navigate = useNavigate()
  const { register, isLoading, clearError } = useAuth()

  // État du formulaire avec TOUS les champs possibles
  const [formData, setFormData] = useState({
    // Champs communs à tous les types
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    userType: 'player', // Par défaut pour les tests
    
    // Champs spécifiques aux joueurs
    gender: '',
    collegeId: '',
    termsAccepted: false,
    newsletterOptIn: false,
    referralSource: '',
    
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

  // Données de référence pour les dropdowns
  const [referenceData, setReferenceData] = useState({
    njcaaColleges: [],
    ncaaColleges: [],
    loading: true
  })

  /**
   * 🔄 Chargement des données de référence (collèges)
   */
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        // Pour les tests, on utilise des données mockées
        // En production, ces données viendraient de votre API /reference
        setReferenceData({
          njcaaColleges: [
            { id: 1, name: 'Sample NJCAA College 1', city: 'City 1', state: 'State 1' },
            { id: 2, name: 'Sample NJCAA College 2', city: 'City 2', state: 'State 2' },
            { id: 3, name: 'Sample NJCAA College 3', city: 'City 3', state: 'State 3' }
          ],
          ncaaColleges: [
            { id: 1, name: 'Sample NCAA College 1', division: 'ncaa_d1' },
            { id: 2, name: 'Sample NCAA College 2', division: 'ncaa_d2' },
            { id: 3, name: 'Sample NCAA College 3', division: 'ncaa_d3' }
          ],
          loading: false
        })
      } catch (error) {
        console.error('Failed to load reference data:', error)
        setReferenceData(prev => ({ ...prev, loading: false }))
      }
    }

    loadReferenceData()
  }, [])

  /**
   * ✅ Nettoyage d'erreur au montage
   */
  useEffect(() => {
    clearError()
  }, [clearError])

  /**
   * 📝 Gestion des changements avec réinitialisation conditionnelle
   */
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    
    setFormData(prev => {
      const newData = { ...prev }
      
      // Gestion spéciale pour les checkboxes
      if (type === 'checkbox') {
        newData[name] = checked
      } else {
        newData[name] = value
      }
      
      // Si changement de userType, réinitialiser les champs spécifiques
      if (name === 'userType') {
        // Garder seulement les champs communs
        Object.keys(newData).forEach(key => {
          if (!['email', 'password', 'confirmPassword', 'firstName', 'lastName', 'userType'].includes(key)) {
            if (typeof newData[key] === 'boolean') {
              newData[key] = false
            } else {
              newData[key] = ''
            }
          }
        })
      }
      
      return newData
    })

    // Effacer l'erreur du champ modifié
    setFormErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      }
      return prev
    })
  }, [])

  /**
   * ✅ Validation complète selon le type d'utilisateur
   */
  const validateForm = useCallback(() => {
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

    // Validation spécifique selon le type d'utilisateur
    if (formData.userType === 'player') {
      if (!formData.gender) {
        errors.gender = 'Gender selection is required for team placement'
      }
      
      if (!formData.collegeId) {
        errors.collegeId = 'Please select your NJCAA college'
      }
      
      if (!formData.termsAccepted) {
        errors.termsAccepted = 'You must accept the terms and conditions to register'
      }
      
      // newsletterOptIn est requis mais peut être false
      if (typeof formData.newsletterOptIn !== 'boolean') {
        errors.newsletterOptIn = 'Newsletter preference is required'
      }
    }

    if (formData.userType === 'coach') {
      if (!formData.coachPosition) {
        errors.coachPosition = 'Position is required'
      }
      if (!formData.coachPhoneNumber) {
        errors.coachPhoneNumber = 'Phone number is required'
      }
      if (!formData.coachCollegeId) {
        errors.coachCollegeId = 'College selection is required'
      }
      if (!formData.coachDivision) {
        errors.coachDivision = 'Division is required'
      }
      if (!formData.coachTeamSport) {
        errors.coachTeamSport = 'Team sport is required'
      }
    }

    if (formData.userType === 'njcaa_coach') {
      if (!formData.njcaaPosition) {
        errors.njcaaPosition = 'Position is required'
      }
      if (!formData.njcaaPhoneNumber) {
        errors.njcaaPhoneNumber = 'Phone number is required'
      }
      if (!formData.njcaaCollegeId) {
        errors.njcaaCollegeId = 'College selection is required'
      }
      if (!formData.njcaaDivision) {
        errors.njcaaDivision = 'Division is required'
      }
      if (!formData.njcaaTeamSport) {
        errors.njcaaTeamSport = 'Team sport is required'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [formData])

  /**
   * 🚀 Préparation des données selon le format backend
   */
  const prepareRegistrationData = useCallback(() => {
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
        gender: formData.gender,
        collegeId: parseInt(formData.collegeId),
        termsAccepted: formData.termsAccepted,
        newsletterOptIn: formData.newsletterOptIn,
        ...(formData.referralSource && { referralSource: formData.referralSource })
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
  }, [formData])

  /**
   * 🚀 Soumission du formulaire
   */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Please correct the errors before submitting')
      return
    }

    setIsSubmitting(true)

    try {
      const registrationData = prepareRegistrationData()
      console.log(`📝 Attempting registration for ${formData.userType}:`, registrationData)
      
      const result = await register(registrationData)

      if (result.success) {
        if (result.user && result.tokens) {
          toast.success('Account created successfully! Welcome to Portall!')
          navigate('/dashboard')
        } else {
          toast.success('Account created! Please wait for admin approval.')
          navigate('/login')
        }
      } else {
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
  }, [formData.userType, validateForm, prepareRegistrationData, register, navigate])

  /**
   * 🎨 Rendu des champs spécifiques selon le type d'utilisateur
   */
  const renderUserTypeSpecificFields = () => {
    if (formData.userType === 'player') {
      return (
        <div className="form-section">
          <h3>Player Information</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="gender">Gender *</label>
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

            <div className="form-group">
              <label htmlFor="collegeId">NJCAA College *</label>
              <select
                id="collegeId"
                name="collegeId"
                value={formData.collegeId}
                onChange={handleInputChange}
                className={`form-input ${formErrors.collegeId ? 'error' : ''}`}
                disabled={isSubmitting || referenceData.loading}
              >
                <option value="">Select your college</option>
                {referenceData.njcaaColleges.map(college => (
                  <option key={college.id} value={college.id}>
                    {college.name}
                  </option>
                ))}
              </select>
              {formErrors.collegeId && (
                <span className="error-message">{formErrors.collegeId}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="referralSource">How did you hear about us? (Optional)</label>
            <select
              id="referralSource"
              name="referralSource"
              value={formData.referralSource}
              onChange={handleInputChange}
              className="form-input"
              disabled={isSubmitting}
            >
              <option value="">Please select</option>
              <option value="social_media">Social Media</option>
              <option value="coach_recommendation">Coach Recommendation</option>
              <option value="college_counselor">College Counselor</option>
              <option value="friend">Friend/Family</option>
              <option value="web_search">Web Search</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="newsletterOptIn"
                name="newsletterOptIn"
                checked={formData.newsletterOptIn}
                onChange={handleInputChange}
                className="checkbox-input"
                disabled={isSubmitting}
              />
              <label htmlFor="newsletterOptIn" className="checkbox-label">
                I want to receive updates about new opportunities and platform features
              </label>
              {formErrors.newsletterOptIn && (
                <span className="error-message">{formErrors.newsletterOptIn}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="termsAccepted"
                name="termsAccepted"
                checked={formData.termsAccepted}
                onChange={handleInputChange}
                className={`checkbox-input ${formErrors.termsAccepted ? 'error' : ''}`}
                disabled={isSubmitting}
              />
              <label htmlFor="termsAccepted" className="checkbox-label">
                I accept the <Link to="/terms" className="link">Terms of Service</Link> and <Link to="/privacy" className="link">Privacy Policy</Link> *
              </label>
              {formErrors.termsAccepted && (
                <span className="error-message">{formErrors.termsAccepted}</span>
              )}
            </div>
          </div>
        </div>
      )
    }

    if (formData.userType === 'coach') {
      return (
        <div className="form-section">
          <h3>Coach Information</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="coachPosition">Position *</label>
              <select
                id="coachPosition"
                name="coachPosition"
                value={formData.coachPosition}
                onChange={handleInputChange}
                className={`form-input ${formErrors.coachPosition ? 'error' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Select position</option>
                <option value="head_coach">Head Coach</option>
                <option value="assistant_coach">Assistant Coach</option>
                <option value="recruiting_coordinator">Recruiting Coordinator</option>
              </select>
              {formErrors.coachPosition && (
                <span className="error-message">{formErrors.coachPosition}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="coachPhoneNumber">Phone Number *</label>
              <input
                type="tel"
                id="coachPhoneNumber"
                name="coachPhoneNumber"
                value={formData.coachPhoneNumber}
                onChange={handleInputChange}
                className={`form-input ${formErrors.coachPhoneNumber ? 'error' : ''}`}
                placeholder="(555) 123-4567"
                disabled={isSubmitting}
              />
              {formErrors.coachPhoneNumber && (
                <span className="error-message">{formErrors.coachPhoneNumber}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="coachDivision">Division *</label>
              <select
                id="coachDivision"
                name="coachDivision"
                value={formData.coachDivision}
                onChange={handleInputChange}
                className={`form-input ${formErrors.coachDivision ? 'error' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Select division</option>
                <option value="ncaa_d1">NCAA Division I</option>
                <option value="ncaa_d2">NCAA Division II</option>
                <option value="ncaa_d3">NCAA Division III</option>
                <option value="naia">NAIA</option>
              </select>
              {formErrors.coachDivision && (
                <span className="error-message">{formErrors.coachDivision}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="coachTeamSport">Team *</label>
              <select
                id="coachTeamSport"
                name="coachTeamSport"
                value={formData.coachTeamSport}
                onChange={handleInputChange}
                className={`form-input ${formErrors.coachTeamSport ? 'error' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Select team</option>
                <option value="mens_soccer">Men's Soccer</option>
                <option value="womens_soccer">Women's Soccer</option>
              </select>
              {formErrors.coachTeamSport && (
                <span className="error-message">{formErrors.coachTeamSport}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="coachCollegeId">College *</label>
            <select
              id="coachCollegeId"
              name="coachCollegeId"
              value={formData.coachCollegeId}
              onChange={handleInputChange}
              className={`form-input ${formErrors.coachCollegeId ? 'error' : ''}`}
              disabled={isSubmitting || referenceData.loading}
            >
              <option value="">Select your college</option>
              {referenceData.ncaaColleges.map(college => (
                <option key={college.id} value={college.id}>
                  {college.name} ({college.division.toUpperCase()})
                </option>
              ))}
            </select>
            {formErrors.coachCollegeId && (
              <span className="error-message">{formErrors.coachCollegeId}</span>
            )}
          </div>
        </div>
      )
    }

    if (formData.userType === 'njcaa_coach') {
      return (
        <div className="form-section">
          <h3>NJCAA Coach Information</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="njcaaPosition">Position *</label>
              <select
                id="njcaaPosition"
                name="njcaaPosition"
                value={formData.njcaaPosition}
                onChange={handleInputChange}
                className={`form-input ${formErrors.njcaaPosition ? 'error' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Select position</option>
                <option value="head_coach">Head Coach</option>
                <option value="assistant_coach">Assistant Coach</option>
              </select>
              {formErrors.njcaaPosition && (
                <span className="error-message">{formErrors.njcaaPosition}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="njcaaPhoneNumber">Phone Number *</label>
              <input
                type="tel"
                id="njcaaPhoneNumber"
                name="njcaaPhoneNumber"
                value={formData.njcaaPhoneNumber}
                onChange={handleInputChange}
                className={`form-input ${formErrors.njcaaPhoneNumber ? 'error' : ''}`}
                placeholder="(555) 123-4567"
                disabled={isSubmitting}
              />
              {formErrors.njcaaPhoneNumber && (
                <span className="error-message">{formErrors.njcaaPhoneNumber}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="njcaaDivision">Division *</label>
              <select
                id="njcaaDivision"
                name="njcaaDivision"
                value={formData.njcaaDivision}
                onChange={handleInputChange}
                className={`form-input ${formErrors.njcaaDivision ? 'error' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Select division</option>
                <option value="njcaa_d1">NJCAA Division I</option>
                <option value="njcaa_d2">NJCAA Division II</option>
                <option value="njcaa_d3">NJCAA Division III</option>
              </select>
              {formErrors.njcaaDivision && (
                <span className="error-message">{formErrors.njcaaDivision}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="njcaaTeamSport">Team *</label>
              <select
                id="njcaaTeamSport"
                name="njcaaTeamSport"
                value={formData.njcaaTeamSport}
                onChange={handleInputChange}
                className={`form-input ${formErrors.njcaaTeamSport ? 'error' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Select team</option>
                <option value="mens_soccer">Men's Soccer</option>
                <option value="womens_soccer">Women's Soccer</option>
              </select>
              {formErrors.njcaaTeamSport && (
                <span className="error-message">{formErrors.njcaaTeamSport}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="njcaaCollegeId">NJCAA College *</label>
            <select
              id="njcaaCollegeId"
              name="njcaaCollegeId"
              value={formData.njcaaCollegeId}
              onChange={handleInputChange}
              className={`form-input ${formErrors.njcaaCollegeId ? 'error' : ''}`}
              disabled={isSubmitting || referenceData.loading}
            >
              <option value="">Select your college</option>
              {referenceData.njcaaColleges.map(college => (
                <option key={college.id} value={college.id}>
                  {college.name}
                </option>
              ))}
            </select>
            {formErrors.njcaaCollegeId && (
              <span className="error-message">{formErrors.njcaaCollegeId}</span>
            )}
          </div>
        </div>
      )
    }

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
            {/* Section des informations de base */}
            <div className="form-section">
              <h3>Basic Information</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name *</label>
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
                  <label htmlFor="lastName">Last Name *</label>
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
                <label htmlFor="email">Email Address *</label>
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
                  <label htmlFor="password">Password *</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`form-input ${formErrors.password ? 'error' : ''}`}
                    placeholder="Create a password (8+ characters)"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  {formErrors.password && (
                    <span className="error-message">{formErrors.password}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password *</label>
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
                <label htmlFor="userType">I am a... *</label>
                <select
                  id="userType"
                  name="userType"
                  value={formData.userType}
                  onChange={handleInputChange}
                  className="form-input"
                  disabled={isSubmitting}
                >
                  <option value="player">NJCAA Player</option>
                  <option value="coach">NCAA/NAIA Coach</option>
                  <option value="njcaa_coach">NJCAA Coach</option>
                </select>
              </div>
            </div>

            {/* Champs spécifiques selon le type d'utilisateur */}
            {renderUserTypeSpecificFields()}

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