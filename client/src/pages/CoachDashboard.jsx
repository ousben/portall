// portall/client/src/pages/CoachDashboard.jsx

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@contexts/AuthContext'
import DashboardService from '@services/dashboardService'
import DashboardHeader from '@components/DashboardHeader' // NOUVEAU : Import du header
import toast from 'react-hot-toast'
import './CoachDashboard.css'

/**
 * Dashboard principal pour les coachs NCAA/NAIA
 * 
 * Ce dashboard sert de "centre de commandement" pour le recrutement.
 * Contrairement au dashboard joueur qui est centré sur la gestion personnelle,
 * celui-ci est orienté "business intelligence" et workflows professionnels.
 * 
 * Fonctionnalités principales :
 * - Vue d'ensemble des métriques de recrutement
 * - Gestion des favoris avec statuts de recrutement
 * - Recherches sauvegardées et accès rapide
 * - Analytics de performance de recrutement
 * - Actions rapides pour les tâches courantes
 * 
 * Architecture pédagogique : Ce composant illustre parfaitement comment
 * une même architecture (hooks, services, état local) peut servir des
 * besoins métier complètement différents selon le contexte utilisateur.
 */
function CoachDashboard() {
  // Context d'authentification - même pattern que PlayerDashboard
  const { user, isLoading: authLoading } = useAuth()
  
  // États pour les différentes sections du dashboard coach
  const [dashboardData, setDashboardData] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [favorites, setFavorites] = useState(null)
  const [savedSearches, setSavedSearches] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // États pour les actions interactives
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [activeTab, setActiveTab] = useState('overview') // overview, favorites, search, analytics

  /**
   * Chargement orchestré des données coach
   * 
   * Cette fonction illustre un pattern important : l'orchestration de
   * multiples appels API en parallèle. Pour un coach, nous devons charger
   * plusieurs types de données simultanément pour construire une vue complète.
   * 
   * Concept pédagogique : Promise.allSettled vs Promise.all
   * - Promise.all échoue si une seule promesse échoue
   * - Promise.allSettled attend toutes les promesses et collecte les résultats
   * Ici nous utilisons allSettled car certaines données sont moins critiques.
   */
  const loadCoachData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('🔄 Loading coach dashboard data...')

      // Chargement en parallèle de toutes les données coach
      // Pattern avancé : utilisation de Promise.allSettled pour gérer
      // les échecs partiels gracieusement
      const results = await Promise.allSettled([
        DashboardService.getCoachDashboard(),
        DashboardService.getCoachAnalytics(),
        DashboardService.getCoachFavorites({ limit: 5 }), // 5 favoris récents
        DashboardService.getSavedSearches()
      ])

      // Traitement intelligent des résultats avec gestion d'erreurs granulaire
      const [dashboardResult, analyticsResult, favoritesResult, searchesResult] = results

      // Dashboard principal (critique - doit réussir)
      if (dashboardResult.status === 'fulfilled' && dashboardResult.value.success) {
        setDashboardData(dashboardResult.value.data)
        console.log('✅ Dashboard data loaded successfully')
      } else {
        throw new Error(dashboardResult.value?.message || 'Failed to load dashboard')
      }

      // Analytics (importantes mais non bloquantes)
      if (analyticsResult.status === 'fulfilled' && analyticsResult.value.success) {
        setAnalytics(analyticsResult.value.data)
        console.log('✅ Analytics data loaded successfully')
      } else {
        console.warn('⚠️ Analytics failed to load:', analyticsResult.reason)
      }

      // Favoris (importantes pour le workflow quotidien)
      if (favoritesResult.status === 'fulfilled' && favoritesResult.value.success) {
        setFavorites(favoritesResult.value.data)
        console.log('✅ Favorites data loaded successfully')
      } else {
        console.warn('⚠️ Favorites failed to load:', favoritesResult.reason)
      }

      // Recherches sauvegardées (utiles mais non critiques)
      if (searchesResult.status === 'fulfilled' && searchesResult.value.success) {
        setSavedSearches(searchesResult.value.data)
        console.log('✅ Saved searches loaded successfully')
      } else {
        console.warn('⚠️ Saved searches failed to load:', searchesResult.reason)
      }

    } catch (error) {
      console.error('❌ Error loading coach dashboard:', error)
      setError(error.message)
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Effect de chargement initial - même pattern que PlayerDashboard
  useEffect(() => {
    if (user && user.userType === 'coach' && !authLoading) {
      loadCoachData()
    }
  }, [user, authLoading, loadCoachData])

  /**
   * Recherche rapide de joueurs depuis le dashboard
   * 
   * Cette fonction illustre comment intégrer des fonctionnalités de recherche
   * directement dans le dashboard pour un accès rapide. C'est un pattern UX
   * couramment utilisé dans les applications professionnelles.
   */
  const handleQuickSearch = useCallback(async (searchCriteria = {}) => {
    try {
      setIsSearching(true)
      
      console.log('🔍 Performing quick search with criteria:', searchCriteria)

      const result = await DashboardService.searchPlayers({
        limit: 10, // Limiter pour affichage rapide
        ...searchCriteria
      })

      if (result.success) {
        setSearchResults(result.data)
        setActiveTab('search')
        toast.success(`Found ${result.data.players.length} players`)
        console.log('✅ Quick search completed successfully')
      } else {
        throw new Error(result.message)
      }

    } catch (error) {
      console.error('❌ Error in quick search:', error)
      toast.error('Search failed. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }, [])

  /**
   * Ajout rapide aux favoris depuis le dashboard
   * 
   * Fonction utilitaire pour permettre l'ajout de joueurs aux favoris
   * directement depuis les résultats de recherche dans le dashboard.
   */
  const handleAddToFavorites = useCallback(async (playerId, playerName) => {
    try {
      console.log(`⭐ Adding player ${playerId} to favorites`)

      const result = await DashboardService.addPlayerToFavorites(playerId, {
        priority: 'medium',
        notes: `Added from dashboard search on ${new Date().toDateString()}`
      })

      if (result.success) {
        toast.success(`${playerName} added to favorites!`)
        // Recharger les favoris pour mettre à jour l'affichage
        const favoritesResult = await DashboardService.getCoachFavorites({ limit: 5 })
        if (favoritesResult.success) {
          setFavorites(favoritesResult.data)
        }
        console.log('✅ Player added to favorites successfully')
      } else {
        throw new Error(result.message)
      }

    } catch (error) {
      console.error('❌ Error adding to favorites:', error)
      toast.error('Failed to add to favorites')
    }
  }, [])

  /**
   * Génération d'initiales pour l'avatar - même logique que PlayerDashboard
   */
  const getUserInitials = useCallback(() => {
    if (!user) return '?'
    const firstName = user.firstName || ''
    const lastName = user.lastName || ''
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }, [user])

  // Gestion des états de chargement et d'erreur (même pattern)
  if (authLoading || isLoading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <div className="card-header">
            <span className="card-icon">⚠️</span>
            <h2 className="card-title">Error Loading Dashboard</h2>
          </div>
          <div className="card-content">
            <p>{error}</p>
            <button 
              onClick={loadCoachData}
              className="quick-action-btn"
              style={{ marginTop: 'var(--spacing-md)' }}
            >
              🔄 Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <div className="card-content">
            <p>No dashboard data available.</p>
          </div>
        </div>
      </div>
    )
  }

  const { profile, recruiting, recommendations, quickActions } = dashboardData

  return (
    <div>
      
    {/* NOUVEAU : Header de navigation intégré */}
    <DashboardHeader 
      title={`Coach ${user.lastName}'s Center`}
      subtitle={`${profile?.college?.name} • ${profile?.division?.toUpperCase()} • ${profile?.teamSport?.replace('_', ' ')}`}
    />

    <div className="dashboard-container">
      {/* En-tête du dashboard coach avec contexte professionnel */}
      <div className="dashboard-header">
        <div className="dashboard-welcome">
          <div>
            <h1 className="dashboard-title">
              Coach {user.lastName}'s Recruiting Center 🏟️
            </h1>
            <p className="dashboard-subtitle">
              {profile?.college?.name} • {profile?.division?.toUpperCase()} • {profile?.teamSport?.replace('_', ' ')}
            </p>
          </div>
          <div className="user-avatar">
            {getUserInitials()}
          </div>
        </div>

        {/* Navigation par onglets pour organiser les différentes vues */}
        <div className="dashboard-tabs">
          <button 
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button 
            className={`tab-button ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            ⭐ Favorites
          </button>
          <button 
            className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            🔍 Search
          </button>
          <button 
            className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            📈 Analytics
          </button>
        </div>

        {/* Actions rapides contextuelles selon l'onglet actif */}
        <div className="quick-actions">
          {activeTab === 'overview' && (
            <>
              <button 
                className="quick-action-btn"
                onClick={() => handleQuickSearch({ gender: profile?.teamSport?.includes('mens') ? 'male' : 'female' })}
                disabled={isSearching}
              >
                <span className="action-icon">🔍</span>
                {isSearching ? 'Searching...' : 'Find Players'}
              </button>
              
              <button 
                className="quick-action-btn secondary"
                onClick={() => setActiveTab('favorites')}
              >
                <span className="action-icon">⭐</span>
                Review Favorites
              </button>
            </>
          )}
          
          {activeTab === 'search' && (
            <button 
              className="quick-action-btn"
              onClick={() => handleQuickSearch()}
              disabled={isSearching}
            >
              <span className="action-icon">🔄</span>
              {isSearching ? 'Searching...' : 'New Search'}
            </button>
          )}
          
          <button className="quick-action-btn secondary">
            <span className="action-icon">✏️</span>
            Edit Profile
          </button>
        </div>
      </div>

      {/* Contenu principal selon l'onglet actif */}
      {activeTab === 'overview' && (
        <>
          {/* Statistiques de recrutement */}
          <div className="stats-grid">
            <div className="stat-card">
              <h3 className="stat-number">{recruiting?.statistics?.totalFavorites || 0}</h3>
              <p className="stat-label">Total Favorites</p>
              <div className="stat-trend trend-stable">
                🎯 Players in your pipeline
              </div>
            </div>

            <div className="stat-card">
              <h3 className="stat-number">{recruiting?.statistics?.activeRecruitments || 0}</h3>
              <p className="stat-label">Active Recruitments</p>
              <div className="stat-trend trend-up">
                🔥 Currently evaluating
              </div>
            </div>

            <div className="stat-card">
              <h3 className="stat-number">{recruiting?.statistics?.thisMonth?.newFavorites || 0}</h3>
              <p className="stat-label">New This Month</p>
              <div className="stat-trend trend-stable">
                📅 Recent additions
              </div>
            </div>

            <div className="stat-card">
              <h3 className="stat-number">{profile?.totalSearches || 0}</h3>
              <p className="stat-label">Total Searches</p>
              <div className="stat-trend trend-stable">
                🔍 Search activity
              </div>
            </div>
          </div>

          {/* Grille principale avec favoris récents et recommandations */}
          <div className="dashboard-grid">
            {/* Favoris récents */}
            <div className="dashboard-card">
              <div className="card-header">
                <span className="card-icon">⭐</span>
                <h2 className="card-title">Recent Favorites</h2>
              </div>
              <div className="card-content">
                {favorites?.favorites?.length > 0 ? (
                  <div className="favorites-list">
                    {favorites.favorites.slice(0, 5).map((favorite, index) => (
                      <div key={index} className="list-item">
                        <div className="item-primary">
                          {favorite.player.firstName} {favorite.player.lastName}
                        </div>
                        <div className="item-secondary">
                          {favorite.player.college?.name} • {favorite.player.gender}
                        </div>
                        <div className="item-meta">
                          <span className={`badge badge-${favorite.favorite.priority === 'high' ? 'danger' : favorite.favorite.priority === 'medium' ? 'warning' : 'info'}`}>
                            {favorite.favorite.priority}
                          </span>
                          <span className="favorite-date">
                            {new Date(favorite.favorite.favoritedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No favorites yet. Start searching for players!</p>
                    <button 
                      className="quick-action-btn"
                      onClick={() => handleQuickSearch()}
                    >
                      🔍 Find Players
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Recherches sauvegardées */}
            <div className="dashboard-card">
              <div className="card-header">
                <span className="card-icon">💾</span>
                <h2 className="card-title">Saved Searches</h2>
              </div>
              <div className="card-content">
                {savedSearches?.searches?.length > 0 ? (
                  <div className="saved-searches-list">
                    {savedSearches.searches.slice(0, 3).map((search, index) => (
                      <div key={index} className="list-item">
                        <div className="item-primary">
                          {search.name}
                        </div>
                        <div className="item-secondary">
                          Used {search.useCount || 0} times
                        </div>
                        <div className="item-meta">
                          <button 
                            className="quick-action-btn secondary small"
                            onClick={() => handleQuickSearch(search.criteria)}
                          >
                            🔄 Run
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No saved searches yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recommandations pour le coach */}
            {recommendations && recommendations.length > 0 && (
              <div className="dashboard-card">
                <div className="card-header">
                  <span className="card-icon">💡</span>
                  <h2 className="card-title">Recommendations</h2>
                </div>
                <div className="card-content">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="recommendation-item">
                      <div className="recommendation-icon">
                        {rec.type === 'search_activity' ? '🔍' : 
                         rec.type === 'favorites_review' ? '⭐' : 
                         rec.type === 'profile_update' ? '✏️' : '💡'}
                      </div>
                      <div className="recommendation-content">
                        <h4>{rec.title}</h4>
                        <p>{rec.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Onglet Favoris détaillé */}
      {activeTab === 'favorites' && (
        <div className="favorites-detailed">
          <div className="dashboard-card">
            <div className="card-header">
              <span className="card-icon">⭐</span>
              <h2 className="card-title">All Favorites</h2>
            </div>
            <div className="card-content">
              {favorites?.favorites?.length > 0 ? (
                <div className="favorites-grid">
                  {favorites.favorites.map((favorite, index) => (
                    <div key={index} className="favorite-card">
                      <div className="favorite-header">
                        <h3>{favorite.player.firstName} {favorite.player.lastName}</h3>
                        <span className={`badge badge-${favorite.favorite.priority === 'high' ? 'danger' : favorite.favorite.priority === 'medium' ? 'warning' : 'info'}`}>
                          {favorite.favorite.priority}
                        </span>
                      </div>
                      <div className="favorite-details">
                        <p><strong>College:</strong> {favorite.player.college?.name}</p>
                        <p><strong>State:</strong> {favorite.player.college?.state}</p>
                        <p><strong>Gender:</strong> {favorite.player.gender}</p>
                        <p><strong>Views:</strong> {favorite.player.profileViews}</p>
                      </div>
                      <div className="favorite-status">
                        <span className={`badge badge-info`}>
                          {favorite.favorite.status}
                        </span>
                        <small>Added {new Date(favorite.favorite.favoritedAt).toLocaleDateString()}</small>
                      </div>
                      {favorite.favorite.notes && (
                        <div className="favorite-notes">
                          <strong>Notes:</strong> {favorite.favorite.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h3>No favorites yet</h3>
                  <p>Start searching for players and add them to your favorites to track prospects.</p>
                  <button 
                    className="quick-action-btn"
                    onClick={() => setActiveTab('search')}
                  >
                    🔍 Start Searching
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Onglet Recherche */}
      {activeTab === 'search' && (
        <div className="search-section">
          <div className="dashboard-card">
            <div className="card-header">
              <span className="card-icon">🔍</span>
              <h2 className="card-title">Search Players</h2>
            </div>
            <div className="card-content">
              <div className="search-filters">
                <button 
                  className="quick-action-btn"
                  onClick={() => handleQuickSearch({ gender: 'male' })}
                  disabled={isSearching}
                >
                  🔍 Men's Players
                </button>
                <button 
                  className="quick-action-btn secondary"
                  onClick={() => handleQuickSearch({ gender: 'female' })}
                  disabled={isSearching}
                >
                  🔍 Women's Players
                </button>
                <button 
                  className="quick-action-btn secondary"
                  onClick={() => handleQuickSearch({ profileStatus: 'completed' })}
                  disabled={isSearching}
                >
                  🔍 Complete Profiles
                </button>
              </div>

              {/* Résultats de recherche */}
              {searchResults && (
                <div className="search-results">
                  <h3>Search Results ({searchResults.players?.length || 0} players)</h3>
                  {searchResults.players?.length > 0 ? (
                    <div className="players-grid">
                      {searchResults.players.map((player, index) => (
                        <div key={index} className="player-card">
                          <div className="player-header">
                            <h4>{player.user.firstName} {player.user.lastName}</h4>
                            <span className={`badge badge-${player.gender === 'male' ? 'info' : 'warning'}`}>
                              {player.gender}
                            </span>
                          </div>
                          <div className="player-details">
                            <p><strong>College:</strong> {player.college?.name}</p>
                            <p><strong>State:</strong> {player.college?.state}</p>
                            <p><strong>Views:</strong> {player.profileViews}</p>
                            <p><strong>Status:</strong> {player.profileCompletionStatus}</p>
                          </div>
                          <div className="player-actions">
                            <button 
                              className="quick-action-btn small"
                              onClick={() => handleAddToFavorites(player.id, `${player.user.firstName} ${player.user.lastName}`)}
                            >
                              ⭐ Add to Favorites
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No players found with current criteria.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Onglet Analytics */}
      {activeTab === 'analytics' && (
        <div className="analytics-section">
          <div className="dashboard-card">
            <div className="card-header">
              <span className="card-icon">📈</span>
              <h2 className="card-title">Recruiting Analytics</h2>
            </div>
            <div className="card-content">
              {analytics ? (
                <div className="analytics-grid">
                  <div className="analytics-summary">
                    <h3>Performance Summary</h3>
                    <div className="analytics-stats">
                      <div className="analytics-item">
                        <strong>Search Efficiency:</strong> {analytics.performance?.recruitingEfficiency || 0}%
                      </div>
                      <div className="analytics-item">
                        <strong>Profile Completeness:</strong> {analytics.performance?.profileCompleteness || 0}%
                      </div>
                      <div className="analytics-item">
                        <strong>Engagement Score:</strong> {analytics.performance?.engagementScore || 0}/100
                      </div>
                    </div>
                  </div>
                  
                  {analytics.recommendations && analytics.recommendations.length > 0 && (
                    <div className="optimization-recommendations">
                      <h3>Optimization Recommendations</h3>
                      {analytics.recommendations.map((rec, index) => (
                        <div key={index} className="recommendation-item">
                          <div className="recommendation-content">
                            <h4>{rec.title}</h4>
                            <p>{rec.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <p>Analytics data is loading...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

export default CoachDashboard