// portall/client/src/pages/auth/RegisterPage.jsx

import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import toast from 'react-hot-toast'

/**
 * 📝 Page d'Inscription Complète - VERSION CORRIGÉE FINALE
 * 
 * Cette version intègre toutes les corrections identifiées durant le débogage :
 * - ✅ Correction du dropdown referralSource avec valeurs exactes du backend
 * - ✅ Ajout de logging détaillé pour le debugging
 * - ✅ Correction de prepareRegistrationData avec validation finale
 * - ✅ Valeurs par défaut explicites dans useState
 * - ✅ Maintien de toute la logique existante pour les autres types d'utilisateurs
 * 
 * 🎯 Corrections apportées :
 * - Résolution du problème "Missing required player fields"
 * - Alignement des valeurs referralSource avec le backend
 * - Ajout de sécurités supplémentaires côté client
 */
const RegisterPage = () => {
  const navigate = useNavigate()
  const { register, isLoading, clearError } = useAuth()

  // 🔧 CORRECTION 1 : État du formulaire avec valeurs par défaut explicites
  const [formData, setFormData] = useState({
    // Champs communs à tous les types
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    userType: 'player', // Par défaut pour les tests
    
    // 🎯 CHAMPS JOUEURS - VALEURS PAR DÉFAUT EXPLICITES (évite undefined)
    gender: '',
    dateOfBirth: '',        // ✅ Chaîne vide explicite
    height: '',             // ✅ Chaîne vide explicite  
    weight: '',             // ✅ Chaîne vide explicite
    position: '',           // ✅ Chaîne vide explicite
    collegeId: '',
    currentYear: '',        // ✅ Chaîne vide explicite
    graduationYear: '',     // ✅ Chaîne vide explicite
    termsAccepted: false,
    newsletterOptIn: false,
    referralSource: '',     // ✅ Chaîne vide explicite
    
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
   * 🔄 Chargement des données de référence (collèges) - INCHANGÉ
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
   * ✅ Nettoyage d'erreur au montage - INCHANGÉ
   */
  useEffect(() => {
    clearError()
  }, [clearError])

  /**
   * 📝 Gestion des changements avec réinitialisation conditionnelle - INCHANGÉ
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
   * ✅ Validation complète selon le type d'utilisateur - INCHANGÉ
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

    // 🎯 VALIDATION JOUEURS - TOUS LES CHAMPS REQUIS
    if (formData.userType === 'player') {
      if (!formData.gender) {
        errors.gender = 'Gender selection is required for team placement'
      }
      
      if (!formData.dateOfBirth) {
        errors.dateOfBirth = 'Date of birth is required'
      } else {
        // Validation d'âge (doit avoir entre 16 et 25 ans)
        const birthDate = new Date(formData.dateOfBirth)
        const today = new Date()
        const age = today.getFullYear() - birthDate.getFullYear()
        
        if (age < 16 || age > 25) {
          errors.dateOfBirth = 'Age must be between 16 and 25 years'
        }
      }
      
      if (!formData.height) {
        errors.height = 'Height is required'
      } else if (parseInt(formData.height) < 60 || parseInt(formData.height) > 84) {
        errors.height = 'Height must be between 60 and 84 inches'
      }
      
      if (!formData.weight) {
        errors.weight = 'Weight is required'
      } else if (parseInt(formData.weight) < 100 || parseInt(formData.weight) > 300) {
        errors.weight = 'Weight must be between 100 and 300 pounds'
      }
      
      if (!formData.position) {
        errors.position = 'Playing position is required'
      }
      
      if (!formData.collegeId) {
        errors.collegeId = 'Please select your NJCAA college'
      }
      
      if (!formData.currentYear) {
        errors.currentYear = 'Current academic year is required'
      }
      
      if (!formData.graduationYear) {
        errors.graduationYear = 'Expected graduation year is required'
      } else {
        const currentYear = new Date().getFullYear()
        const gradYear = parseInt(formData.graduationYear)
        
        if (gradYear < currentYear || gradYear > currentYear + 4) {
          errors.graduationYear = 'Graduation year must be within next 4 years'
        }
      }
      
      if (!formData.termsAccepted) {
        errors.termsAccepted = 'You must accept the terms and conditions to register'
      }
      
      // newsletterOptIn est requis mais peut être false
      if (typeof formData.newsletterOptIn !== 'boolean') {
        errors.newsletterOptIn = 'Newsletter preference is required'
      }
    }

    // Validation coachs NCAA/NAIA (inchangée)
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

    // Validation coachs NJCAA (inchangée)
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
   * 🔧 CORRECTION 2 : Préparation des données avec validation finale côté client
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

    // 🎯 JOUEURS : TOUS les champs requis avec vérifications
    if (formData.userType === 'player') {
      const playerData = {
        ...baseData,
        // Champs requis par createPlayerProfile - TOUS présents et validés
        gender: formData.gender || '',
        dateOfBirth: formData.dateOfBirth || '',
        height: formData.height ? parseInt(formData.height) : '',
        weight: formData.weight ? parseInt(formData.weight) : '',
        position: formData.position || '',
        collegeId: formData.collegeId ? parseInt(formData.collegeId) : '',
        currentYear: formData.currentYear || '',
        graduationYear: formData.graduationYear ? parseInt(formData.graduationYear) : '',
        
        // Champs optionnels (ne causent pas d'erreur s'ils manquent)
        termsAccepted: formData.termsAccepted || false,
        newsletterOptIn: formData.newsletterOptIn || false,
        ...(formData.referralSource && { referralSource: formData.referralSource })
      }

      // 🔍 Validation finale côté client (sécurité supplémentaire)
      const requiredPlayerFields = ['gender', 'dateOfBirth', 'height', 'weight', 'position', 'collegeId', 'currentYear', 'graduationYear']
      const missingFields = requiredPlayerFields.filter(field => !playerData[field] && playerData[field] !== 0)
      
      if (missingFields.length > 0) {
        console.error('❌ Missing required fields before sending:', missingFields)
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
      }

      return playerData
    }

    // Coachs NCAA/NAIA (inchangé)
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

    // Coachs NJCAA (inchangé)
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
   * 🔧 CORRECTION 3 : Soumission du formulaire avec logging détaillé
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
      
      // 🔍 DEBUG : Vérification détaillée des données avant envoi
      console.log('=== DEBUG REGISTRATION DATA ===')
      console.log('All form data:', formData)
      console.log('Prepared registration data:', registrationData)
      
      // Vérification spécifique pour les joueurs
      if (formData.userType === 'player') {
        const requiredFields = ['dateOfBirth', 'height', 'weight', 'position', 'gender', 'collegeId', 'currentYear', 'graduationYear']
        console.log('Required player fields check:')
        requiredFields.forEach(field => {
          const value = registrationData[field]
          console.log(`  ${field}: ${value} (type: ${typeof value}, empty: ${!value})`)
        })
      }
      console.log('=== END DEBUG ===')
      
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
          <h3>🏈 Player Information</h3>
          
          {/* Première rangée : Genre et Date de naissance */}
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
              <label htmlFor="dateOfBirth">Date of Birth *</label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                className={`form-input ${formErrors.dateOfBirth ? 'error' : ''}`}
                disabled={isSubmitting}
                max={new Date().toISOString().split('T')[0]} // Pas de date future
              />
              {formErrors.dateOfBirth && (
                <span className="error-message">{formErrors.dateOfBirth}</span>
              )}
            </div>
          </div>

          {/* Deuxième rangée : Taille et Poids */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="height">Height (inches) *</label>
              <input
                type="number"
                id="height"
                name="height"
                value={formData.height}
                onChange={handleInputChange}
                className={`form-input ${formErrors.height ? 'error' : ''}`}
                placeholder="e.g., 72"
                min="60"
                max="84"
                disabled={isSubmitting}
              />
              <small className="form-hint">Between 5'0" (60) and 7'0" (84)</small>
              {formErrors.height && (
                <span className="error-message">{formErrors.height}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="weight">Weight (lbs) *</label>
              <input
                type="number"
                id="weight"
                name="weight"
                value={formData.weight}
                onChange={handleInputChange}
                className={`form-input ${formErrors.weight ? 'error' : ''}`}
                placeholder="e.g., 180"
                min="100"
                max="300"
                disabled={isSubmitting}
              />
              <small className="form-hint">Between 100 and 300 pounds</small>
              {formErrors.weight && (
                <span className="error-message">{formErrors.weight}</span>
              )}
            </div>
          </div>

          {/* Troisième rangée : Position */}
          <div className="form-group">
            <label htmlFor="position">Playing Position *</label>
            <select
              id="position"
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              className={`form-input ${formErrors.position ? 'error' : ''}`}
              disabled={isSubmitting}
            >
              <option value="">Select your position</option>
    
              {/* Positions de Soccer Organisées par Zones */}
              <optgroup label="Goalkeeping">
                <option value="goalkeeper">Goalkeeper (GK)</option>
              </optgroup>
    
              <optgroup label="Defensive Positions">
                <option value="center_back">Center Back (CB)</option>
                <option value="full_back">Full Back (FB)</option>
                <option value="wing_back">Wing Back (WB)</option>
                <option value="sweeper">Sweeper (SW)</option>
              </optgroup>
    
              <optgroup label="Midfield Positions">
                <option value="defensive_midfielder">Defensive Midfielder (DM)</option>
                <option value="central_midfielder">Central Midfielder (CM)</option>
                <option value="attacking_midfielder">Attacking Midfielder (AM)</option>
                <option value="wide_midfielder">Wide Midfielder (WM)</option>
                <option value="winger">Winger (W)</option>
              </optgroup>
    
              <optgroup label="Forward Positions">
                <option value="striker">Striker (ST)</option>
                <option value="center_forward">Center Forward (CF)</option>
                <option value="second_striker">Second Striker (SS)</option>
                <option value="left_winger">Left Winger (LW)</option>
                <option value="right_winger">Right Winger (RW)</option>
              </optgroup>
            </select>
            {formErrors.position && (
              <span className="error-message">{formErrors.position}</span>
            )}
          </div>

          {/* Quatrième rangée : Collège */}
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
              <option value="">
                {referenceData.loading ? 'Loading colleges...' : 'Select your college'}
              </option>
              {referenceData.njcaaColleges.map(college => (
                <option key={college.id} value={college.id}>
                  {college.name} - {college.city}, {college.state}
                </option>
              ))}
            </select>
            {formErrors.collegeId && (
              <span className="error-message">{formErrors.collegeId}</span>
            )}
          </div>

          {/* Cinquième rangée : Années académiques */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="currentYear">Current Academic Year *</label>
              <select
                id="currentYear"
                name="currentYear"
                value={formData.currentYear}
                onChange={handleInputChange}
                className={`form-input ${formErrors.currentYear ? 'error' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Select current year</option>
                <option value="freshman">Freshman (1st year)</option>
                <option value="sophomore">Sophomore (2nd year)</option>
                <option value="redshirt">Redshirt</option>
              </select>
              {formErrors.currentYear && (
                <span className="error-message">{formErrors.currentYear}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="graduationYear">Expected Graduation Year *</label>
              <select
                id="graduationYear"
                name="graduationYear"
                value={formData.graduationYear}
                onChange={handleInputChange}
                className={`form-input ${formErrors.graduationYear ? 'error' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Select graduation year</option>
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() + i
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  )
                })}
              </select>
              {formErrors.graduationYear && (
                <span className="error-message">{formErrors.graduationYear}</span>
              )}
            </div>
          </div>

          {/* 🔧 CORRECTION 4 : Sixième rangée - Source de référence avec valeurs backend */}
          <div className="form-group">
            <label htmlFor="referralSource">How did you hear about Portall? (Optional)</label>
            <select
              id="referralSource"
              name="referralSource"
              value={formData.referralSource}
              onChange={handleInputChange}
              className="form-input"
              disabled={isSubmitting}
            >
              <option value="">Select a source</option>
              {/* ✅ VALEURS CORRIGÉES pour correspondre exactement au backend */}
              <option value="coach_recommendation">My coach told me</option>
              <option value="friend">Teammate/Friend recommendation</option>
              <option value="social_media">Social media</option>
              <option value="web_search">Google search</option>
              <option value="college_counselor">College counselor</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Septième rangée : Conditions et newsletter - INCHANGÉ */}
          <div className="form-section">
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="termsAccepted"
                  checked={formData.termsAccepted}
                  onChange={handleInputChange}
                  className={formErrors.termsAccepted ? 'error' : ''}
                  disabled={isSubmitting}
                />
                <span className="checkmark"></span>
                I accept the <Link to="/terms" target="_blank">Terms of Service</Link> and 
                <Link to="/privacy" target="_blank"> Privacy Policy</Link> *
              </label>
              {formErrors.termsAccepted && (
                <span className="error-message">{formErrors.termsAccepted}</span>
              )}
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="newsletterOptIn"
                  checked={formData.newsletterOptIn}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                />
                <span className="checkmark"></span>
                I want to receive recruiting tips and updates via email
              </label>
              <small className="form-hint">
                Stay informed about opportunities and recruiting advice
              </small>
            </div>
          </div>
        </div>
      )
    }

    // Formulaire Coach NCAA/NAIA - COMPLÈTEMENT INCHANGÉ
    if (formData.userType === 'coach') {
      return (
        <div className="form-section">
          <h3>🏈 Coach Information</h3>
          
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
                <option value="">Select your position</option>
                <option value="head_coach">Head Coach</option>
                <option value="assistant_coach">Assistant Coach</option>
                <option value="staff_member">Staff Member</option>
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

          <div className="form-group">
            <label htmlFor="coachCollegeId">College/University *</label>
            <select
              id="coachCollegeId"
              name="coachCollegeId"
              value={formData.coachCollegeId}
              onChange={handleInputChange}
              className={`form-input ${formErrors.coachCollegeId ? 'error' : ''}`}
              disabled={isSubmitting || referenceData.loading}
            >
              <option value="">
                {referenceData.loading ? 'Loading colleges...' : 'Select your institution'}
              </option>
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
              <label htmlFor="coachTeamSport">Sport *</label>
              <select
                id="coachTeamSport"
                name="coachTeamSport"
                value={formData.coachTeamSport}
                onChange={handleInputChange}
                className={`form-input ${formErrors.coachTeamSport ? 'error' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Select sport</option>
                <option value="mens_soccer">Men's Soccer</option>
                <option value="womens_soccer">Women's Soccer</option>
              </select>
              {formErrors.coachTeamSport && (
                <span className="error-message">{formErrors.coachTeamSport}</span>
              )}
            </div>
          </div>
        </div>
      )
    }

    // Formulaire Coach NJCAA - COMPLÈTEMENT INCHANGÉ
    if (formData.userType === 'njcaa_coach') {
      return (
        <div className="form-section">
          <h3>🏟️ NJCAA Coach Information</h3>
          
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
                <option value="">Select your position</option>
                <option value="head_coach">Head Coach</option>
                <option value="assistant_coach">Assistant Coach</option>
                <option value="staff_member">Staff Member</option>
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
              <option value="">
                {referenceData.loading ? 'Loading colleges...' : 'Select your college'}
              </option>
              {referenceData.njcaaColleges.map(college => (
                <option key={college.id} value={college.id}>
                  {college.name} - {college.city}, {college.state}
                </option>
              ))}
            </select>
            {formErrors.njcaaCollegeId && (
              <span className="error-message">{formErrors.njcaaCollegeId}</span>
            )}
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
              <label htmlFor="njcaaTeamSport">Sport *</label>
              <select
                id="njcaaTeamSport"
                name="njcaaTeamSport"
                value={formData.njcaaTeamSport}
                onChange={handleInputChange}
                className={`form-input ${formErrors.njcaaTeamSport ? 'error' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">Select sport</option>
                <option value="mens_soccer">Men's Soccer</option>
                <option value="womens_soccer">Women's Soccer</option>
              </select>
              {formErrors.njcaaTeamSport && (
                <span className="error-message">{formErrors.njcaaTeamSport}</span>
              )}
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form-container">
          {/* Header - INCHANGÉ */}
          <div className="auth-header">
            <h1>Join Portall</h1>
            <p>Create your account and start your recruiting journey</p>
          </div>

          {/* Formulaire principal */}
          <form onSubmit={handleSubmit} className="auth-form">
            {/* Champs communs - COMPLÈTEMENT INCHANGÉ */}
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

            {/* Bouton de soumission - INCHANGÉ */}
            <button
              type="submit"
              className={`auth-button ${isSubmitting ? 'loading' : ''}`}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Liens utiles - COMPLÈTEMENT INCHANGÉ */}
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