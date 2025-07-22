// portall/client/src/pages/profile/ProfileEdit.jsx
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import DashboardHeader from '@components/dashboard/DashboardHeader'
import toast from 'react-hot-toast'

/**
 * ✏️ Page d'Édition de Profil - Interface Adaptative Phase 5B
 * 
 * Cette page illustre un concept architectural fondamental : "l'interface polymorphe".
 * Comme un caméléon change de couleur selon son environnement, cette page change
 * de structure et de contenu selon le type d'utilisateur, tout en conservant
 * une logique de base cohérente.
 * 
 * 🎯 Concept pédagogique : "Adaptive Form Architecture"
 * Imaginez cette page comme un formulaire intelligent qui pose les bonnes questions
 * à la bonne personne. Un joueur verra des champs liés à ses performances sportives,
 * un coach verra des champs liés à son expérience d'entraînement, etc.
 * 
 * 🏗️ Architecture en couches :
 * 1. Couche de données : Gestion de l'état et des appels API
 * 2. Couche de logique : Validation et transformation des données
 * 3. Couche de présentation : Interface adaptée au type d'utilisateur
 * 4. Couche d'interaction : Gestion des événements et feedbacks
 * 
 * Cette séparation claire facilite la maintenance et l'extension du système
 * quand de nouveaux types d'utilisateurs ou de nouveaux champs sont ajoutés.
 */
function ProfileEdit() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()

  // États pour la gestion du formulaire et de l'interface
  const [profileData, setProfileData] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  /**
   * 📡 Chargement initial des données de profil
   * 
   * Cette fonction illustre comment gérer l'hydratation d'un formulaire complexe
   * avec des données provenant de différentes sources selon le type d'utilisateur.
   * C'est comme assembler un puzzle où chaque pièce vient d'un endroit différent.
   */
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setIsLoading(true)
        
        console.log(`📊 Loading profile data for ${user?.userType} user`)
        
        // Construction de l'endpoint selon le type d'utilisateur
        // Cette logique illustre le principe de "routing adaptatif"
        const endpoint = getProfileEndpoint(user?.userType)
        
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          
          // Normalisation des données selon le schéma attendu par le formulaire
          const normalizedData = normalizeProfileData(data.data, user?.userType)
          setProfileData(normalizedData)
          
          console.log('✅ Profile data loaded and normalized successfully')
        } else {
          throw new Error('Failed to load profile data')
        }
      } catch (error) {
        console.error('❌ Error loading profile data:', error)
        toast.error('Failed to load profile information')
        
        // Initialisation avec des données par défaut pour éviter les erreurs
        setProfileData(getDefaultProfileData(user?.userType))
      } finally {
        setIsLoading(false)
      }
    }

    if (user?.userType) {
      loadProfileData()
    }
  }, [user?.userType])

  /**
   * 🛡️ Protection contre la perte de données
   * 
   * Cette fonction illustre un pattern important : la prévention de la perte accidentelle
   * de données utilisateur. C'est comme un filet de sécurité qui empêche l'utilisateur
   * de quitter accidentellement la page avec des modifications non sauvegardées.
   */
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasUnsavedChanges) {
        event.preventDefault()
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return event.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  /**
   * 🔄 Gestion intelligente des changements de formulaire
   * 
   * Cette fonction illustre le concept de "reactive state management". Chaque changement
   * dans le formulaire déclenche une série de validations et de mises à jour d'état
   * qui maintiennent la cohérence et la qualité des données.
   */
  const handleInputChange = useCallback((field, value) => {
    console.log(`📝 Profile field changed: ${field}`)
    
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Marquer qu'il y a des changements non sauvegardés
    setHasUnsavedChanges(true)
    
    // Effacer l'erreur du champ modifié (validation réactive)
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
    
    // Validation en temps réel pour les champs critiques
    validateFieldRealTime(field, value, user?.userType)
  }, [formErrors, user?.userType])

  /**
   * ✅ Validation contextuelle des données
   * 
   * Cette fonction illustre comment implémenter une validation intelligente qui
   * s'adapte aux règles métier spécifiques de chaque type d'utilisateur.
   * C'est comme avoir un assistant expert qui connaît les exigences de chaque domaine.
   */
  const validateProfile = useCallback(() => {
    const errors = {}
    
    // Validation commune à tous les utilisateurs
    if (!profileData.firstName?.trim()) {
      errors.firstName = 'First name is required'
    }
    
    if (!profileData.lastName?.trim()) {
      errors.lastName = 'Last name is required'
    }
    
    if (!profileData.email?.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
      errors.email = 'Please enter a valid email address'
    }
    
    // Validation spécifique selon le type d'utilisateur
    switch (user?.userType) {
      case 'player':
        errors = { ...errors, ...validatePlayerSpecificFields(profileData) }
        break
      case 'coach':
      case 'njcaa_coach':
        errors = { ...errors, ...validateCoachSpecificFields(profileData) }
        break
      case 'admin':
        errors = { ...errors, ...validateAdminSpecificFields(profileData) }
        break
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [profileData, user?.userType])

  /**
   * 💾 Sauvegarde intelligente du profil
   * 
   * Cette fonction illustre la gestion d'une opération complexe avec feedback utilisateur
   * en temps réel. Elle coordonne la validation, l'envoi des données, et la gestion
   * des états d'interface pour une expérience utilisateur fluide.
   */
  const handleSaveProfile = useCallback(async () => {
    console.log('💾 Attempting to save profile changes...')
    
    // Validation avant sauvegarde
    if (!validateProfile()) {
      toast.error('Please correct the errors before saving')
      return
    }
    
    try {
      setIsSaving(true)
      
      // Construction des données à envoyer selon le format attendu par l'API
      const payload = transformProfileDataForAPI(profileData, user?.userType)
      
      // Endpoint spécifique selon le type d'utilisateur
      const endpoint = getProfileUpdateEndpoint(user?.userType)
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const result = await response.json()
        
        // Mise à jour du contexte utilisateur si nécessaire
        if (result.data.user) {
          updateUser(result.data.user)
        }
        
        setHasUnsavedChanges(false)
        toast.success('Profile updated successfully!')
        
        console.log('✅ Profile saved successfully')
        
        // Redirection optionnelle vers la vue du profil
        // navigate('/profile/view')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update profile')
      }
    } catch (error) {
      console.error('❌ Error saving profile:', error)
      toast.error(error.message || 'Failed to save profile changes')
    } finally {
      setIsSaving(false)
    }
  }, [profileData, user?.userType, validateProfile, updateUser])

  /**
   * 🎨 Génération du formulaire adaptatif
   * 
   * Cette fonction illustre le concept de "dynamic form generation". Au lieu d'avoir
   * des formulaires séparés pour chaque type d'utilisateur, nous générons dynamiquement
   * les champs appropriés. C'est comme avoir un moule qui change de forme selon le besoin.
   */
  const renderFormSections = () => {
    const sections = []
    
    // Section commune : Informations personnelles
    sections.push(renderPersonalInfoSection())
    
    // Sections spécifiques selon le type d'utilisateur
    switch (user?.userType) {
      case 'player':
        sections.push(
          renderPlayerAthleticInfo(),
          renderPlayerAcademicInfo(),
          renderPlayerContactPreferences()
        )
        break
        
      case 'coach':
        sections.push(
          renderCoachExperience(),
          renderCoachInstitutionInfo(),
          renderCoachRecruitmentPreferences()
        )
        break
        
      case 'njcaa_coach':
        sections.push(
          renderNJCAACoachInfo(),
          renderTeamManagementPreferences(),
          renderEvaluationSettings()
        )
        break
        
      case 'admin':
        sections.push(
          renderAdminPermissions(),
          renderSystemPreferences()
        )
        break
    }
    
    return sections.filter(Boolean) // Éliminer les sections nulles ou vides
  }

  /**
   * 📱 Interface de chargement pendant l'hydratation des données
   */
  if (isLoading) {
    return (
      <div className="profile-edit profile-edit--loading">
        <DashboardHeader 
          title="Edit Profile" 
          subtitle="Loading your profile information..."
        />
        <div className="profile-edit__loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading your profile data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`profile-edit profile-edit--${user?.userType}`}>
      {/* 📱 En-tête avec actions de sauvegarde */}
      <DashboardHeader
        title="Edit Profile"
        subtitle="Update your information and preferences"
        customActions={
          <div className="profile-edit__header-actions">
            <button
              onClick={() => navigate('/profile/view')}
              className="btn btn--outline btn--sm"
              disabled={isSaving}
            >
              👁️ Preview
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={isSaving || !hasUnsavedChanges}
              className="btn btn--primary btn--sm"
            >
              {isSaving ? 'Saving...' : '💾 Save Changes'}
            </button>
          </div>
        }
      />

      {/* 📝 Contenu principal du formulaire */}
      <main className="profile-edit__main">
        <div className="profile-edit__container">
          
          {/* 🚨 Indicateur de changements non sauvegardés */}
          {hasUnsavedChanges && (
            <div className="profile-edit__unsaved-banner">
              <div className="unsaved-banner">
                <span className="unsaved-banner__icon">⚠️</span>
                <span className="unsaved-banner__text">
                  You have unsaved changes
                </span>
                <button
                  onClick={handleSaveProfile}
                  className="unsaved-banner__save-btn"
                  disabled={isSaving}
                >
                  Save Now
                </button>
              </div>
            </div>
          )}

          {/* 📋 Formulaire adaptatif par sections */}
          <form className="profile-edit__form" onSubmit={(e) => e.preventDefault()}>
            {renderFormSections()}
          </form>

          {/* 🎯 Actions de pied de page */}
          <div className="profile-edit__footer">
            <div className="profile-edit__footer-actions">
              <button
                onClick={() => navigate(-1)}
                className="btn btn--outline"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving || !hasUnsavedChanges}
                className="btn btn--primary"
              >
                {isSaving ? (
                  <>
                    <span className="btn__spinner"></span>
                    Saving Profile...
                  </>
                ) : (
                  '💾 Save Changes'
                )}
              </button>
            </div>
            
            {hasUnsavedChanges && (
              <p className="profile-edit__footer-note">
                💡 Don't forget to save your changes before leaving this page
              </p>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

/**
 * 🛠️ Fonctions utilitaires pour la gestion des données
 * 
 * Ces fonctions illustrent le principe de "separation of concerns" en séparant
 * la logique de transformation de données de la logique d'interface utilisateur.
 */

// Détermination de l'endpoint selon le type d'utilisateur
const getProfileEndpoint = (userType) => {
  const endpoints = {
    player: '/api/players/profile',
    coach: '/api/coaches/profile', 
    njcaa_coach: '/api/njcaa-coaches/profile',
    admin: '/api/admin/profile'
  }
  return endpoints[userType] || '/api/auth/me'
}

// Normalisation des données selon le schéma de formulaire
const normalizeProfileData = (apiData, userType) => {
  // Cette fonction transforme les données de l'API en format de formulaire
  // en gérant les différences de structure selon le type d'utilisateur
  const baseData = {
    firstName: apiData.firstName || '',
    lastName: apiData.lastName || '',
    email: apiData.email || '',
    phoneNumber: apiData.phoneNumber || ''
  }
  
  // Ajout de champs spécifiques selon le type
  switch (userType) {
    case 'player':
      return {
        ...baseData,
        position: apiData.playerProfile?.position || '',
        height: apiData.playerProfile?.height || '',
        weight: apiData.playerProfile?.weight || '',
        gpa: apiData.playerProfile?.gpa || ''
      }
    case 'coach':
    case 'njcaa_coach':
      return {
        ...baseData,
        coachingExperience: apiData.coachProfile?.experience || '',
        specialization: apiData.coachProfile?.specialization || '',
        collegeId: apiData.coachProfile?.collegeId || ''
      }
    default:
      return baseData
  }
}

// Validation spécifique aux joueurs
const validatePlayerSpecificFields = (data) => {
  const errors = {}
  
  if (data.height && !/^\d{1,2}'\d{1,2}"?$/.test(data.height)) {
    errors.height = 'Height must be in format like 5\'10"'
  }
  
  if (data.weight && (isNaN(data.weight) || data.weight < 50 || data.weight > 500)) {
    errors.weight = 'Weight must be a valid number between 50 and 500 lbs'
  }
  
  if (data.gpa && (isNaN(data.gpa) || data.gpa < 0 || data.gpa > 4)) {
    errors.gpa = 'GPA must be between 0.0 and 4.0'
  }
  
  return errors
}

// Validation spécifique aux coachs
const validateCoachSpecificFields = (data) => {
  const errors = {}
  
  if (!data.coachingExperience) {
    errors.coachingExperience = 'Coaching experience is required'
  }
  
  if (!data.collegeId) {
    errors.collegeId = 'Institution affiliation is required'
  }
  
  return errors
}

// Transformation des données pour l'API
const transformProfileDataForAPI = (formData, userType) => {
  // Cette fonction prépare les données du formulaire pour l'envoi à l'API
  // en respectant le format attendu par le backend
  const basePayload = {
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    phoneNumber: formData.phoneNumber
  }
  
  // Ajout de données spécifiques dans des sous-objets
  switch (userType) {
    case 'player':
      return {
        ...basePayload,
        playerProfile: {
          position: formData.position,
          height: formData.height,
          weight: parseFloat(formData.weight) || null,
          gpa: parseFloat(formData.gpa) || null
        }
      }
    case 'coach':
    case 'njcaa_coach':
      return {
        ...basePayload,
        coachProfile: {
          experience: formData.coachingExperience,
          specialization: formData.specialization,
          collegeId: parseInt(formData.collegeId) || null
        }
      }
    default:
      return basePayload
  }
}

export default ProfileEdit