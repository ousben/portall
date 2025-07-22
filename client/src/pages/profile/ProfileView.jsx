// portall/client/src/pages/profile/ProfileView.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useParams, useNavigate } from 'react-router-dom'
import DashboardHeader from '@components/dashboard/DashboardHeader'
import toast from 'react-hot-toast'

/**
 * 👁️ Page de Visualisation de Profil - Interface Contextuelle Phase 5B
 * 
 * Cette page illustre un concept architectural sophistiqué : "l'interface contextuelle".
 * La même page se comporte différemment selon qui regarde quoi. C'est comme un caméléon
 * social qui adapte son apparence selon son audience et son objectif.
 * 
 * 🎯 Concept pédagogique : "Contextual Display Architecture"
 * Imaginez cette page comme un CV intelligent qui met en avant différents aspects
 * selon qui le lit. Un recruteur verra certaines informations, le propriétaire du profil
 * en verra d'autres, et un collègue aura encore une vue différente.
 * 
 * 🏗️ Contextes de visualisation :
 * 1. Auto-visualisation : L'utilisateur regarde son propre profil
 * 2. Visualisation par pair : Un coach regarde un autre coach
 * 3. Visualisation de recrutement : Un coach regarde un joueur
 * 4. Visualisation administrative : Un admin regarde n'importe qui
 * 
 * Chaque contexte révèle des informations différentes et offre des actions différentes,
 * créant une expérience personnalisée et pertinente pour chaque situation.
 */
function ProfileView() {
  const { user: currentUser } = useAuth()
  const { userId } = useParams()
  const navigate = useNavigate()

  // États pour la gestion des données et de l'interface
  const [profileData, setProfileData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewContext, setViewContext] = useState('self') // self, peer, recruitment, admin
  const [isOwnProfile, setIsOwnProfile] = useState(false)

  /**
   * 📡 Chargement intelligent des données de profil
   * 
   * Cette fonction illustre comment gérer la récupération de données avec
   * des permissions contextuelles. Selon qui regarde et qui est regardé,
   * différentes informations sont exposées ou masquées.
   */
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setIsLoading(true)
        
        // Déterminer quel profil charger (propre profil ou celui d'un autre utilisateur)
        const targetUserId = userId || currentUser?.id
        const isViewingOwnProfile = !userId || userId === currentUser?.id?.toString()
        
        setIsOwnProfile(isViewingOwnProfile)
        
        console.log(`👁️ Loading profile data for user ${targetUserId}`)
        console.log(`🎯 View context: ${isViewingOwnProfile ? 'self' : 'other'}`)
        
        // Construction de l'endpoint avec les permissions appropriées
        const endpoint = buildProfileViewEndpoint(targetUserId, isViewingOwnProfile, currentUser?.userType)
        
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          setProfileData(data.data)
          
          // Détermination du contexte de visualisation
          const context = determineViewContext(data.data, currentUser, isViewingOwnProfile)
          setViewContext(context)
          
          console.log('✅ Profile data loaded successfully')
          console.log(`📊 View context determined: ${context}`)
        } else {
          throw new Error('Failed to load profile data')
        }
      } catch (error) {
        console.error('❌ Error loading profile data:', error)
        toast.error('Failed to load profile information')
        navigate('/dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    if (currentUser?.id) {
      loadProfileData()
    }
  }, [userId, currentUser?.id, currentUser?.userType, navigate])

  /**
   * 🎯 Gestion des actions contextuelles
   * 
   * Cette fonction illustre comment les actions disponibles changent selon
   * le contexte de visualisation. C'est comme avoir un menu qui s'adapte
   * à la situation et aux permissions de l'utilisateur.
   */
  const handleContextualAction = async (actionType, targetData = null) => {
    console.log(`🎯 Executing contextual action: ${actionType}`)
    
    switch (actionType) {
      case 'edit_profile':
        navigate('/profile/edit')
        break
        
      case 'add_to_favorites':
        await handleAddToFavorites(profileData.id)
        break
        
      case 'remove_from_favorites':
        await handleRemoveFromFavorites(profileData.id)
        break
        
      case 'contact_player':
        await handleContactPlayer(profileData.id)
        break
        
      case 'evaluate_player':
        navigate(`/evaluations/new/${profileData.id}`)
        break
        
      case 'view_analytics':
        navigate(`/analytics/profile/${profileData.id}`)
        break
        
      default:
        console.log(`❓ Unknown action: ${actionType}`)
    }
  }

  /**
   * ⭐ Gestion des favoris pour les coachs
   * 
   * Cette fonction illustre comment implémenter une fonctionnalité interactive
   * qui fournit un feedback immédiat et met à jour l'état local.
   */
  const handleAddToFavorites = async (playerId) => {
    try {
      const response = await fetch(`/api/coaches/favorites/${playerId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setProfileData(prev => ({
          ...prev,
          isFavorited: true
        }))
        toast.success('Player added to your favorites')
      } else {
        throw new Error('Failed to add to favorites')
      }
    } catch (error) {
      console.error('❌ Error adding to favorites:', error)
      toast.error('Failed to add player to favorites')
    }
  }

  /**
   * 🎨 Rendu adaptatif selon le contexte de visualisation
   * 
   * Cette fonction illustre le concept de "adaptive rendering" où le même
   * composant produit des interfaces différentes selon le contexte d'utilisation.
   */
  const renderProfileContent = () => {
    if (!profileData) return null

    switch (viewContext) {
      case 'self':
        return renderSelfViewProfile()
      case 'recruitment':
        return renderRecruitmentViewProfile()
      case 'peer':
        return renderPeerViewProfile()
      case 'admin':
        return renderAdminViewProfile()
      default:
        return renderPublicViewProfile()
    }
  }

  /**
   * 🎨 Génération des actions contextuelles pour l'en-tête
   * 
   * Cette fonction crée dynamiquement les boutons d'action appropriés
   * selon le contexte de visualisation et les permissions de l'utilisateur.
   */
  const getContextualActions = () => {
    const actions = []

    if (isOwnProfile) {
      actions.push(
        <button
          key="edit"
          onClick={() => handleContextualAction('edit_profile')}
          className="btn btn--primary btn--sm"
        >
          ✏️ Edit Profile
        </button>
      )
      
      if (currentUser?.userType === 'player') {
        actions.push(
          <button
            key="analytics"
            onClick={() => handleContextualAction('view_analytics')}
            className="btn btn--outline btn--sm"
          >
            📊 View Analytics
          </button>
        )
      }
    } else {
      // Actions pour visualiser le profil d'un autre utilisateur
      if (currentUser?.userType === 'coach' && profileData?.userType === 'player') {
        actions.push(
          <button
            key="favorite"
            onClick={() => handleContextualAction(
              profileData.isFavorited ? 'remove_from_favorites' : 'add_to_favorites'
            )}
            className={`btn btn--sm ${profileData.isFavorited ? 'btn--outline' : 'btn--primary'}`}
          >
            {profileData.isFavorited ? '💔 Remove Favorite' : '⭐ Add to Favorites'}
          </button>
        )
      }
      
      if (currentUser?.userType === 'njcaa_coach' && profileData?.userType === 'player') {
        actions.push(
          <button
            key="evaluate"
            onClick={() => handleContextualAction('evaluate_player')}
            className="btn btn--primary btn--sm"
          >
            📝 Evaluate Player
          </button>
        )
      }
    }

    return actions
  }

  /**
   * 📱 Interface de chargement contextuelle
   */
  if (isLoading) {
    return (
      <div className="profile-view profile-view--loading">
        <DashboardHeader 
          title="Profile" 
          subtitle="Loading profile information..."
        />
        <div className="profile-view__loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading profile data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`profile-view profile-view--${viewContext}`}>
      {/* 📱 En-tête avec actions contextuelles */}
      <DashboardHeader
        title={isOwnProfile ? "Your Profile" : `${profileData?.firstName}'s Profile`}
        subtitle={getProfileSubtitle(profileData, viewContext)}
        customActions={
          <div className="profile-view__header-actions">
            {getContextualActions()}
          </div>
        }
      />

      {/* 👁️ Contenu principal du profil */}
      <main className="profile-view__main">
        <div className="profile-view__container">
          
          {/* 🎯 Indicateur de contexte de visualisation */}
          <div className="profile-view__context-banner">
            <div className={`context-banner context-banner--${viewContext}`}>
              <span className="context-banner__icon">
                {getContextIcon(viewContext)}
              </span>
              <span className="context-banner__text">
                {getContextDescription(viewContext, isOwnProfile)}
              </span>
            </div>
          </div>

          {/* 📋 Contenu du profil adaptatif */}
          <div className="profile-view__content">
            {renderProfileContent()}
          </div>

        </div>
      </main>
    </div>
  )
}

/**
 * 🛠️ Fonctions utilitaires pour la gestion contextuelle
 * 
 * Ces fonctions illustrent comment encapsuler la logique complexe de détermination
 * de contexte et de permissions dans des fonctions réutilisables et testables.
 */

// Construction de l'endpoint selon les permissions
const buildProfileViewEndpoint = (userId, isOwnProfile, viewerType) => {
  if (isOwnProfile) {
    // Visualisation de son propre profil - accès complet
    const endpoints = {
      player: '/api/players/profile',
      coach: '/api/coaches/profile',
      njcaa_coach: '/api/njcaa-coaches/profile',
      admin: '/api/admin/profile'
    }
    return endpoints[viewerType] || '/api/auth/me'
  } else {
    // Visualisation du profil d'un autre utilisateur - accès restreint
    return `/api/users/${userId}/profile`
  }
}

// Détermination du contexte de visualisation
const determineViewContext = (profileData, currentUser, isOwnProfile) => {
  if (isOwnProfile) {
    return 'self'
  }
  
  if (currentUser?.userType === 'admin') {
    return 'admin'
  }
  
  if (currentUser?.userType === 'coach' && profileData?.userType === 'player') {
    return 'recruitment'
  }
  
  if (currentUser?.userType === profileData?.userType) {
    return 'peer'
  }
  
  return 'public'
}

// Génération de sous-titres contextuels
const getProfileSubtitle = (profileData, context) => {
  const subtitles = {
    self: 'This is how others see your profile',
    recruitment: `Potential recruit - ${profileData?.college?.name || 'NJCAA Player'}`,
    peer: `Fellow ${profileData?.userType || 'colleague'}`,
    admin: `Platform user - ${profileData?.userType || 'Unknown type'}`,
    public: 'Public profile view'
  }
  
  return subtitles[context] || 'Profile information'
}

// Icônes contextuelles
const getContextIcon = (context) => {
  const icons = {
    self: '👤',
    recruitment: '🎯',
    peer: '🤝',
    admin: '🛡️',
    public: '🌍'
  }
  
  return icons[context] || '👁️'
}

// Descriptions contextuelles
const getContextDescription = (context, isOwnProfile) => {
  if (isOwnProfile) {
    return 'This is your public profile as others see it'
  }
  
  const descriptions = {
    recruitment: 'Viewing as potential recruit for your program',
    peer: 'Viewing colleague profile',
    admin: 'Administrative view with full access',
    public: 'Limited public information available'
  }
  
  return descriptions[context] || 'Profile view'
}

export default ProfileView