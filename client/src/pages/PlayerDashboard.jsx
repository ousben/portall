// portall/client/src/pages/PlayerDashboard.jsx

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@contexts/AuthContext'
import DashboardService from '@services/dashboardService'
import DashboardHeader from '@components/DashboardHeader' // NOUVEAU : Import du header
import toast from 'react-hot-toast'
import './PlayerDashboard.css'

/**
 * Dashboard principal pour les joueurs NJCAA
 * 
 * Cette page sert de "centre de contrôle" pour les joueurs, leur permettant de :
 * - Voir leur profil complet et son statut
 * - Consulter leurs statistiques de visibilité
 * - Gérer les paramètres de leur profil
 * - Recevoir des recommandations personnalisées
 * 
 * Architecture : Ce composant suit vos patterns établis avec useAuth, 
 * gestion d'état local, et appels API via services découplés.
 */
function PlayerDashboard() {
  // Context d'authentification pour accéder aux infos utilisateur
  const { user, isLoading: authLoading } = useAuth()
  
  // États locaux pour gérer les données et l'interface
  const [dashboardData, setDashboardData] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false)

  /**
   * Chargement initial des données du dashboard
   * 
   * Cette fonction orchestre le chargement de toutes les données nécessaires
   * au dashboard en parallèle pour optimiser les performances.
   */
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('🔄 Loading player dashboard data...')

      // Charger les données principales et analytics en parallèle
      const [dashboardResult, analyticsResult] = await Promise.all([
        DashboardService.getPlayerDashboard(),
        DashboardService.getPlayerAnalytics()
      ])

      // Vérifier les résultats et gérer les erreurs
      if (dashboardResult.success) {
        setDashboardData(dashboardResult.data)
        console.log('✅ Dashboard data loaded successfully')
      } else {
        throw new Error(dashboardResult.message)
      }

      if (analyticsResult.success) {
        setAnalytics(analyticsResult.data)
        console.log('✅ Analytics data loaded successfully')
      } else {
        console.warn('⚠️ Analytics failed to load:', analyticsResult.message)
        // Analytics non critiques, on continue sans
      }

    } catch (error) {
      console.error('❌ Error loading dashboard:', error)
      setError(error.message)
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Charger les données au montage du composant
  useEffect(() => {
    if (user && user.userType === 'player' && !authLoading) {
      loadDashboardData()
    }
  }, [user, authLoading, loadDashboardData])

  /**
   * Gestion du toggle de visibilité du profil
   * 
   * Cette fonction permet au joueur de contrôler si son profil
   * est visible par les coachs ou reste privé.
   */
  const handleVisibilityToggle = useCallback(async () => {
    if (!dashboardData?.profile) return

    try {
      setIsUpdatingVisibility(true)
      
      const newVisibility = !dashboardData.profile.isProfileVisible
      
      console.log(`🔄 Toggling profile visibility to: ${newVisibility}`)

      const result = await DashboardService.toggleProfileVisibility(newVisibility)

      if (result.success) {
        // Mettre à jour l'état local immédiatement pour une UX fluide
        setDashboardData(prev => ({
          ...prev,
          profile: {
            ...prev.profile,
            isProfileVisible: newVisibility
          }
        }))

        toast.success(
          newVisibility 
            ? '👁️ Your profile is now visible to coaches!' 
            : '🔒 Your profile is now private'
        )
        
        console.log('✅ Profile visibility updated successfully')
      } else {
        throw new Error(result.message)
      }

    } catch (error) {
      console.error('❌ Error updating visibility:', error)
      toast.error('Failed to update profile visibility')
    } finally {
      setIsUpdatingVisibility(false)
    }
  }, [dashboardData?.profile])

  /**
   * Calcul du pourcentage de complétude du profil
   * 
   * Cette fonction analyse les champs du profil pour déterminer
   * le niveau de complétude et encourage l'utilisateur à l'améliorer.
   */
  const getCompletionPercentage = useCallback(() => {
    if (!dashboardData?.profile) return 0
    return dashboardData.profile.completionPercentage || 0
  }, [dashboardData?.profile])

  /**
   * Génération des initiales pour l'avatar
   * 
   * Simple fonction utilitaire pour créer un avatar textuel
   * à partir du prénom et nom de l'utilisateur.
   */
  const getUserInitials = useCallback(() => {
    if (!user) return '?'
    const firstName = user.firstName || ''
    const lastName = user.lastName || ''
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }, [user])

  // États de chargement et d'erreur avec interfaces appropriées
  if (authLoading || isLoading) {
    return (
      <div>
        <DashboardHeader 
          title="Player Dashboard" 
          subtitle="Loading your player data..."
        />
        <div className="dashboard-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <DashboardHeader 
          title="Player Dashboard" 
          subtitle="Error loading dashboard"
        />
        <div className="dashboard-container">
          <div className="dashboard-card">
            <div className="card-header">
              <span className="card-icon">⚠️</span>
              <h2 className="card-title">Error Loading Dashboard</h2>
            </div>
            <div className="card-content">
              <p>{error}</p>
              <button 
                onClick={loadDashboardData}
                className="quick-action-btn"
                style={{ marginTop: 'var(--spacing-md)' }}
              >
                🔄 Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div>
        <DashboardHeader 
          title="Player Dashboard" 
          subtitle="No data available"
        />
        <div className="dashboard-container">
          <div className="dashboard-card">
            <div className="card-content">
              <p>No dashboard data available.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { profile, statistics, recentActivity, recommendations } = dashboardData
  const completionPercentage = getCompletionPercentage()

  return (
    <div>
      {/* NOUVEAU : Header de navigation intégré */}
      <DashboardHeader 
        title={`${user.firstName}'s Dashboard`}
        subtitle={`NJCAA Player • ${profile.college?.name || 'College TBD'}`}
      />

      <div className="dashboard-container">
        {/* Grille de statistiques principales */}
        <div className="stats-grid">
          <div className="stat-card">
            <h3 className="stat-number">{statistics?.totalViews || 0}</h3>
            <p className="stat-label">Profile Views</p>
            <div className="stat-trend trend-stable">
              👀 Coaches viewing your profile
            </div>
          </div>

          <div className="stat-card">
            <h3 className="stat-number">{completionPercentage}%</h3>
            <p className="stat-label">Profile Complete</p>
            <div className={`stat-trend ${completionPercentage >= 80 ? 'trend-up' : 'trend-down'}`}>
              {completionPercentage >= 80 ? '✅ Excellent!' : '⚠️ Needs improvement'}
            </div>
          </div>

          <div className="stat-card">
            <h3 className="stat-number">
              <span className={`badge ${profile.isProfileVisible ? 'badge-success' : 'badge-warning'}`}>
                {profile.isProfileVisible ? 'Public' : 'Private'}
              </span>
            </h3>
            <p className="stat-label">Profile Status</p>
            <div className="stat-trend trend-stable">
              {profile.isProfileVisible ? '🌟 Visible to coaches' : '🔒 Hidden from coaches'}
            </div>
          </div>

          <div className="stat-card">
            <h3 className="stat-number">
              {profile.college?.name ? '✅' : '❌'}
            </h3>
            <p className="stat-label">College Info</p>
            <div className="stat-trend trend-stable">
              {profile.college?.name || 'Not specified'}
            </div>
          </div>
        </div>

        {/* Grille principale du dashboard */}
        <div className="dashboard-grid">
          {/* Informations du profil */}
          <div className="dashboard-card">
            <div className="card-header">
              <span className="card-icon">👤</span>
              <h2 className="card-title">Profile Overview</h2>
            </div>
            <div className="card-content">
              <div className="profile-info">
                <div className="info-row">
                  <strong>Name:</strong> {user.firstName} {user.lastName}
                </div>
                <div className="info-row">
                  <strong>Email:</strong> {user.email}
                </div>
                <div className="info-row">
                  <strong>Gender:</strong> {profile.gender || 'Not specified'}
                </div>
                <div className="info-row">
                  <strong>College:</strong> {profile.college?.name || 'Not specified'}
                </div>
                {profile.college?.state && (
                  <div className="info-row">
                    <strong>State:</strong> {profile.college.state}
                  </div>
                )}
                <div className="info-row">
                  <strong>Profile Status:</strong> 
                  <span className={`badge ${profile.profileCompletionStatus === 'premium' ? 'badge-success' : 'badge-info'}`}>
                    {profile.profileCompletionStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recommandations personnalisées */}
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
                      {rec.type === 'profile_completion' ? '📝' : 
                       rec.type === 'visibility' ? '👁️' : 
                       rec.type === 'exposure' ? '📈' : '💡'}
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

          {/* Activité récente */}
          {recentActivity && recentActivity.length > 0 && (
            <div className="dashboard-card">
              <div className="card-header">
                <span className="card-icon">📊</span>
                <h2 className="card-title">Recent Activity</h2>
              </div>
              <div className="card-content">
                <div className="activity-list">
                  {recentActivity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="list-item">
                      <div className="item-primary">
                        {activity.icon} {activity.description}
                      </div>
                      <div className="item-secondary">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Analytics rapides */}
          {analytics && (
            <div className="dashboard-card">
              <div className="card-header">
                <span className="card-icon">📈</span>
                <h2 className="card-title">Performance Insights</h2>
              </div>
              <div className="card-content">
                <div className="analytics-summary">
                  <div className="analytics-item">
                    <strong>This Month:</strong> {analytics.profileViews?.thisMonth || 0} views
                  </div>
                  <div className="analytics-item">
                    <strong>This Week:</strong> {analytics.profileViews?.thisWeek || 0} views
                  </div>
                  <div className="analytics-item">
                    <strong>Trend:</strong> 
                    <span className={`trend-${analytics.profileViews?.trend || 'stable'}`}>
                      {analytics.profileViews?.trend === 'increasing' ? '📈 Growing' :
                       analytics.profileViews?.trend === 'decreasing' ? '📉 Declining' :
                       '➡️ Stable'}
                    </span>
                  </div>
                  <div className="analytics-item">
                    <strong>Last Update:</strong> {
                      profile.lastProfileUpdate 
                          ? new Date(profile.lastProfileUpdate).toLocaleDateString()
                          : 'Never'
                      }
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlayerDashboard