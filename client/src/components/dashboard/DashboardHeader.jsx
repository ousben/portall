// portall/client/src/components/dashboard/DashboardHeader.jsx
import { useState, useCallback } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'

/**
 * 📱 En-tête de Dashboard Universel - Phase 5B
 * 
 * Ce composant illustre un principe fondamental de l'architecture React :
 * la création de composants réutilisables qui encapsulent une fonctionnalité
 * commune à plusieurs pages.
 * 
 * 🎯 Concept pédagogique : "Don't Repeat Yourself" (DRY)
 * Au lieu de dupliquer la logique de navigation dans chaque dashboard,
 * nous créons un composant central qui gère tous les aspects de la navigation.
 * 
 * 🔧 Avantages de cette approche :
 * 1. Maintenance centralisée : un seul endroit à modifier
 * 2. Cohérence visuelle : tous les dashboards ont la même navigation
 * 3. Réutilisabilité : peut être utilisé dans n'importe quel dashboard
 * 4. Testabilité : logique isolée donc facile à tester
 * 
 * 📱 Responsive design : S'adapte automatiquement aux différentes tailles d'écran
 */
function DashboardHeader({ 
  title = "Dashboard", 
  subtitle = "", 
  showUserMenu = true,
  customActions = null
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  /**
   * 🚪 Gestion de la déconnexion avec feedback utilisateur
   * 
   * Cette fonction montre comment gérer une action asynchrone importante
   * avec tous les états intermédiaires : chargement, succès, erreur.
   * 
   * Pattern utilisé : Async State Management
   */
  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true)
      setIsUserMenuOpen(false)
      
      console.log('🚪 User logout initiated from dashboard')
      
      const result = await logout()
      
      if (result.success !== false) {
        toast.success('Logged out successfully')
        navigate('/', { replace: true })
        console.log('✅ Logout completed successfully')
      }
      
    } catch (error) {
      console.error('❌ Logout error:', error)
      toast.error('Logout failed. Please try again.')
    } finally {
      setIsLoggingOut(false)
    }
  }, [logout, navigate])

  /**
   * 🧭 Navigation intelligente vers les différentes sections
   * 
   * Ces fonctions centralisent la logique de navigation et peuvent
   * être étendues avec des vérifications d'autorisation ou des analytics.
   */
  const navigateToProfile = useCallback(() => {
    setIsUserMenuOpen(false)
    navigate('/profile/edit')
  }, [navigate])

  const navigateToViewProfile = useCallback(() => {
    setIsUserMenuOpen(false)
    navigate('/profile/view')
  }, [navigate])

  const navigateToHome = useCallback(() => {
    navigate('/')
  }, [navigate])

  /**
   * 🎨 Génération des initiales utilisateur pour l'avatar
   * 
   * Fonction utilitaire pour créer un avatar simple et élégant
   * à partir du nom de l'utilisateur.
   */
  const getUserInitials = useCallback(() => {
    if (!user?.firstName || !user?.lastName) return 'U'
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
  }, [user])

  /**
   * 🏷️ Génération du badge de type d'utilisateur
   * 
   * Affiche le type d'utilisateur avec des couleurs distinctives
   * pour une identification rapide.
   */
  const getUserTypeBadge = () => {
    const badges = {
      player: { label: 'Player', color: 'blue' },
      coach: { label: 'Coach', color: 'green' },
      njcaa_coach: { label: 'NJCAA Coach', color: 'purple' },
      admin: { label: 'Administrator', color: 'red' }
    }
    
    const badge = badges[user?.userType] || { label: 'User', color: 'gray' }
    
    return (
      <span className={`user-badge user-badge--${badge.color}`}>
        {badge.label}
      </span>
    )
  }

  /**
   * 📍 Détermination du titre basé sur la route actuelle
   * 
   * Si aucun titre n'est fourni explicitement, nous générons
   * automatiquement un titre basé sur la route actuelle.
   */
  const getPageTitle = () => {
    if (title !== "Dashboard") return title
    
    const path = location.pathname
    if (path.includes('/player')) return 'Player Dashboard'
    if (path.includes('/coach') && !path.includes('njcaa')) return 'Coach Dashboard'
    if (path.includes('/njcaa-coach')) return 'NJCAA Coach Dashboard'
    if (path.includes('/admin')) return 'Admin Dashboard'
    return 'Dashboard'
  }

  return (
    <header className="dashboard-header">
      <div className="dashboard-header__container">
        {/* 🏠 Section logo et navigation principale */}
        <div className="dashboard-header__brand">
          <button
            onClick={navigateToHome}
            className="dashboard-header__logo"
            aria-label="Go to homepage"
          >
            <span className="logo-text">Portall</span>
          </button>
          
          <div className="dashboard-header__title-section">
            <h1 className="dashboard-header__title">{getPageTitle()}</h1>
            {subtitle && (
              <p className="dashboard-header__subtitle">{subtitle}</p>
            )}
          </div>
        </div>

        {/* 🎯 Section actions personnalisées et menu utilisateur */}
        <div className="dashboard-header__actions">
          {/* Actions personnalisées (boutons spécifiques au dashboard) */}
          {customActions && (
            <div className="dashboard-header__custom-actions">
              {customActions}
            </div>
          )}

          {/* Menu utilisateur */}
          {showUserMenu && user && (
            <div className="dashboard-header__user-menu">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="dashboard-header__user-button"
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
              >
                <div className="user-avatar">
                  {getUserInitials()}
                </div>
                <div className="user-info">
                  <span className="user-name">
                    {user.firstName} {user.lastName}
                  </span>
                  {getUserTypeBadge()}
                </div>
                <svg 
                  className={`dropdown-icon ${isUserMenuOpen ? 'dropdown-icon--open' : ''}`}
                  width="20" 
                  height="20" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Menu déroulant */}
              {isUserMenuOpen && (
                <div className="dashboard-header__dropdown">
                  <div className="dropdown-header">
                    <p className="dropdown-user-name">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="dropdown-user-email">{user.email}</p>
                  </div>
                  
                  <div className="dropdown-divider" />
                  
                  <button
                    onClick={navigateToViewProfile}
                    className="dropdown-item"
                  >
                    <svg className="dropdown-icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    View Profile
                  </button>
                  
                  <button
                    onClick={navigateToProfile}
                    className="dropdown-item"
                  >
                    <svg className="dropdown-icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Edit Profile
                  </button>
                  
                  <div className="dropdown-divider" />
                  
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="dropdown-item dropdown-item--danger"
                  >
                    <svg className="dropdown-icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                    </svg>
                    {isLoggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader