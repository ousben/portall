// portall/client/src/pages/auth/RegisterPage.jsx

import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import toast from 'react-hot-toast'

/**
 * 📝 Page d'Inscription Complète - CORRIGÉE pour Phase 5A
 * 
 * Cette version corrige le problème d'inscription des joueurs en ajoutant
 * TOUS les champs requis par le backend dans createPlayerProfile().
 * 
 * 🎯 Corrections apportées :
 * - ✅ Ajout des 6 champs manquants pour les joueurs
 * - ✅ Validation côté client mise à jour
 * - ✅ prepareRegistrationData() corrigée
 * - ✅ Interface utilisateur enrichie
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
    
    // 🎯 CHAMPS JOUEURS - TOUS LES CHAMPS REQUIS MAINTENANT INCLUS
    gender: '',
    dateOfBirth: '',        // ✅ AJOUTÉ
    height: '',             // ✅ AJOUTÉ  
    weight: '',             // ✅ AJOUTÉ
    position: '',           // ✅ AJOUTÉ
    collegeId: '',
    currentYear: '',        // ✅ AJOUTÉ
    graduationYear: '',     // ✅ AJOUTÉ
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
   * ✅ Validation complète selon le type d'utilisateur - MISE À JOUR
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
   * 🚀 Préparation des données selon le format backend - CORRIGÉE
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

    // 🎯 CORRECTION PRINCIPALE : Ajout de TOUS les champs requis pour les joueurs
    if (formData.userType === 'player') {
      return {
        ...baseData,
        // Champs existants
        gender: formData.gender,
        collegeId: parseInt(formData.collegeId),
        
        // ✅ CHAMPS MANQUANTS AJOUTÉS
        dateOfBirth: formData.dateOfBirth,
        height: parseInt(formData.height),
        weight: parseInt(formData.weight),
        position: formData.position,
        currentYear: formData.currentYear,
        graduationYear: parseInt(formData.graduationYear),
        
        // Champs optionnels
        termsAccepted: formData.termsAccepted,
        newsletterOptIn: formData.newsletterOptIn,
        ...(formData.referralSource && { referralSource: formData.referralSource })
      }
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
   * 🎨 Rendu des champs spécifiques selon le type d'utilisateur - MISE À JOUR
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
              
              {/* Positions offensives */}
              <optgroup label="Offensive Positions">
                <option value="quarterback">Quarterback (QB)</option>
                <option value="running_back">Running Back (RB)</option>
                <option value="fullback">Fullback (FB)</option>
                <option value="wide_receiver">Wide Receiver (WR)</option>
                <option value="tight_end">Tight End (TE)</option>
                <option value="offensive_line">Offensive Line (OL)</option>
                <option value="center">Center (C)</option>
                <option value="guard">Guard (G)</option>
                <option value="tackle">Tackle (T)</option>
              </optgroup>
              
              {/* Positions défensives */}
              <optgroup label="Defensive Positions">
                <option value="defensive_end">Defensive End (DE)</option>
                <option value="defensive_tackle">Defensive Tackle (DT)</option>
                <option value="nose_tackle">Nose Tackle (NT)</option>
                <option value="linebacker">Linebacker (LB)</option>
                <option value="cornerback">Cornerback (CB)</option>
                <option value="safety">Safety (S)</option>
                <option value="free_safety">Free Safety (FS)</option>
                <option value="strong_safety">Strong Safety (SS)</option>
              </optgroup>
              
              {/* Équipes spéciales */}
              <optgroup label="Special Teams">
                <option value="kicker">Kicker (K)</option>
                <option value="punter">Punter (P)</option>
                <option value="long_snapper">Long Snapper (LS)</option>
                <option value="return_specialist">Return Specialist</option>
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

          {/* Sixième rangée : Source de référence (optionnel) */}
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
              <option value="coach">My coach told me</option>
              <option value="teammate">Teammate recommendation</option>
              <option value="social_media">Social media</option>
              <option value="google">Google search</option>
              <option value="college_website">College website</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Septième rangée : Conditions et newsletter */}
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

    // Les autres types d'utilisateurs restent inchangés...
    if (formData.userType === 'coach') {
      return (
        <div className="form-section">
          <h3>🏈 Coach Information</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="coachPosition">Position *</label>
              <input
                type="text"
                id="coachPosition"
                name="coachPosition"
                value={formData.coachPosition}
                onChange={handleInputChange}
                className={`form-input ${formErrors.coachPosition ? 'error' : ''}`}
                placeholder="e.g., Head Coach, Assistant Coach"
                disabled={isSubmitting}
              />
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
                <option value="football">Football</option>
                <option value="basketball">Basketball</option>
                <option value="soccer">Soccer</option>
                <option value="baseball">Baseball</option>
                <option value="softball">Softball</option>
                <option value="track_field">Track & Field</option>
                <option value="other">Other</option>
              </select>
              {formErrors.coachTeamSport && (
                <span className="error-message">{formErrors.coachTeamSport}</span>
              )}
            </div>
          </div>
        </div>
      )
    }

    if (formData.userType === 'njcaa_coach') {
      return (
        <div className="form-section">
          <h3>🏟️ NJCAA Coach Information</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="njcaaPosition">Position *</label>
              <input
                type="text"
                id="njcaaPosition"
                name="njcaaPosition"
                value={formData.njcaaPosition}
                onChange={handleInputChange}
                className={`form-input ${formErrors.njcaaPosition ? 'error' : ''}`}
                placeholder="e.g., Head Coach, Assistant Coach"
                disabled={isSubmitting}
              />
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
                <option value="football">Football</option>
                <option value="basketball">Basketball</option>
                <option value="soccer">Soccer</option>
                <option value="baseball">Baseball</option>
                <option value="softball">Softball</option>
                <option value="track_field">Track & Field</option>
                <option value="other">Other</option>
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
          {/* Header */}
          <div className="auth-header">
            <h1>Join Portall</h1>
            <p>Create your account and start your recruiting journey</p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="auth-form">
            {/* Champs communs */}
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