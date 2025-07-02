// portall/client/src/components/DashboardHeader.jsx

import { useState, useCallback } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import './DashboardHeader.css'

/**
 * Header de navigation commun pour tous les dashboards
 * 
 * Ce composant illustre un principe fondamental de l'architecture React :
 * la création de composants réutilisables qui encapsulent une fonctionnalité
 * commune à plusieurs pages.
 * 
 * Concept pédagogique important : "Don't Repeat Yourself" (DRY)
 * Au lieu de dupliquer la logique de navigation dans chaque dashboard,
 * nous créons un composant central qui gère tous les aspects de la navigation.
 * 
 * Cela facilite énormément la maintenance : si nous voulons changer quelque chose
 * dans la navigation, nous n'avons qu'un seul endroit à modifier.
 * 
 * @param {Object} props - Props du composant
 * @param {string} props.title - Titre principal à afficher
 * @param {string} props.subtitle - Sous-titre optionnel
 * @param {boolean} props.showUserMenu - Afficher le menu utilisateur
 */
function DashboardHeader({ 
  title = "Dashboard", 
  subtitle = "", 
  showUserMenu = true 
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  /**
   * Gestion de la déconnexion avec feedback utilisateur
   * 
   * Cette fonction montre comment gérer une action asynchrone importante
   * avec tous les états intermédiaires : chargement, succès, erreur.
   */
  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true)
      setIsUserMenuOpen(false)
      
      console.log('🚪 User logout initiated')
      
      const result = await logout()
      
      if (result.success !== false) { // logout() peut ne pas retourner d'objet
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
   * Navigation vers les différentes sections
   * 
   * Ces fonctions centralisent la logique de navigation et pourraient
   * être étendues avec des vérifications d'autorisation ou des analytics.
   */
  const navigateToProfile = useCallback(() => {
    setIsUserMenuOpen(false)
    navigate('/profile/edit')
  }, [navigate])

  const navigateToAnalytics = useCallback(() => {
    setIsUserMenuOpen(false)
    navigate('/analytics')
  }, [navigate])

  const navigateToHome = useCallback(() => {
    navigate('/')
  }, [navigate])

  /**
   * Génération des initiales utilisateur
   * 
   * Fonction utilitaire pour créer un avatar simple et élégant
   * à partir du nom de l'utilisateur.
   */
  const getUserInitials = useCallback(() => {
    if (!user) return '?'
    const firstName = user.firstName || ''
    const lastName = user.lastName || ''
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }, [user])

  /**
   * Fermeture du menu au clic extérieur
   * 
   * Pattern UX important : fermer les menus déroulants quand l'utilisateur
   * clique ailleurs. Cela améliore l'expérience utilisateur.
   */
  const closeUserMenu = useCallback(() => {
    setIsUserMenuOpen(false)
  }, [])

  return (
    <header className="dashboard-header-nav">
      <div className="header-container">
        {/* Logo et navigation principale */}
        <div className="header-left">
          <div className="header-logo" onClick={navigateToHome}>
            <span className="logo-icon">⚽</span>
            <span className="logo-text">Portall</span>
          </div>
          
          <div className="header-title">
            <h1>{title}</h1>
            {subtitle && <p className="header-subtitle">{subtitle}</p>}
          </div>
        </div>

        {/* Navigation et menu utilisateur */}
        <div className="header-right">
          {showUserMenu && user && (
            <div className="user-menu-container">
              {/* Informations utilisateur */}
              <div className="user-info">
                <span className="user-name">
                  {user.firstName} {user.lastName}
                </span>
                <span className="user-type">
                  {user.userType.charAt(0).toUpperCase() + user.userType.slice(1)}
                </span>
              </div>

              {/* Avatar cliquable */}
              <div 
                className="user-avatar-menu"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div className="user-avatar-small">
                  {getUserInitials()}
                </div>
                <span className="menu-arrow">
                  {isUserMenuOpen ? '▲' : '▼'}
                </span>
              </div>

              {/* Menu déroulant */}
              {isUserMenuOpen && (
                <>
                  {/* Overlay pour fermer le menu */}
                  <div 
                    className="menu-overlay"
                    onClick={closeUserMenu}
                  />
                  
                  <div className="user-dropdown">
                    <div className="dropdown-header">
                      <div className="dropdown-user-info">
                        <div className="dropdown-avatar">
                          {getUserInitials()}
                        </div>
                        <div className="dropdown-details">
                          <strong>{user.firstName} {user.lastName}</strong>
                          <small>{user.email}</small>
                        </div>
                      </div>
                    </div>

                    <div className="dropdown-divider" />

                    <div className="dropdown-actions">
                      <button 
                        className="dropdown-item"
                        onClick={navigateToProfile}
                      >
                        <span className="item-icon">✏️</span>
                        Edit Profile
                      </button>
                      
                      <button 
                        className="dropdown-item"
                        onClick={navigateToAnalytics}
                      >
                        <span className="item-icon">📊</span>
                        Analytics
                      </button>
                      
                      <div className="dropdown-divider" />
                      
                      <button 
                        className="dropdown-item logout-item"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                      >
                        <span className="item-icon">
                          {isLoggingOut ? '⏳' : '🚪'}
                        </span>
                        {isLoggingOut ? 'Logging out...' : 'Logout'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader