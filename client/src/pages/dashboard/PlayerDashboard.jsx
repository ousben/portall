// portall/client/src/pages/dashboard/PlayerDashboard.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import DashboardHeader from '@components/dashboard/DashboardHeader'
import DashboardStats from '@components/dashboard/DashboardStats'
import QuickActions from '@components/dashboard/QuickActions'
import RecentActivity from '@components/dashboard/RecentActivity'
import toast from 'react-hot-toast'

/**
 * 🏟️ Dashboard Joueur NJCAA - Interface Spécialisée Phase 5B
 * 
 * Ce dashboard est conçu spécifiquement pour les joueurs NJCAA qui souhaitent
 * être recrutés par des coachs NCAA/NAIA. Il met l'accent sur la visibilité
 * du profil, les statistiques de vue, et la gestion des informations personnelles.
 * 
 * 🎯 Objectifs métier pour les joueurs :
 * 1. Maximiser la visibilité de leur profil
 * 2. Suivre l'intérêt des coachs (vues, contacts)
 * 3. Maintenir leurs informations à jour
 * 4. Accéder aux opportunités de recrutement
 * 
 * 🏗️ Architecture du dashboard :
 * - En-tête avec navigation universelle
 * - Statistiques de performance (vues, contacts)
 * - Actions rapides (éditer profil, visibilité)
 * - Activité récente (qui a vu le profil)
 * - Recommandations personnalisées
 * 
 * 📊 Intégration API : Utilise les endpoints /api/players/* de votre backend
 */
function PlayerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // États pour les données du dashboard
  const [dashboardData, setDashboardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profileStats, setProfileStats] = useState({
    views: 0,
    coachInterests: 0,
    profileCompletion: 0,
    lastUpdated: null
  })

  /**
   * 📡 Chargement des données du dashboard
   * 
   * Cette fonction centralise tous les appels API nécessaires
   * pour afficher les informations du dashboard joueur.
   */
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true)
        
        // Appel à votre API backend pour récupérer les données du dashboard
        const response = await fetch('/api/players/dashboard', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          setDashboardData(data.data)
          setProfileStats(data.data.stats || profileStats)
          console.log('✅ Player dashboard data loaded successfully')
        } else {
          throw new Error('Failed to load dashboard data')
        }
      } catch (error) {
        console.error('❌ Error loading player dashboard:', error)
        toast.error('Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  /**
   * 🎯 Actions rapides spécifiques aux joueurs
   * 
   * Ces boutons donnent accès aux fonctionnalités les plus importantes
   * pour les joueurs : gestion de profil et paramètres de visibilité.
   */
  const playerQuickActions = [
    {
      title: 'Edit Profile',
      description: 'Update your information and stats',
      icon: '✏️',
      action: () => navigate('/profile/edit'),
      priority: 'primary'
    },
    {
      title: 'View Public Profile',
      description: 'See how coaches see your profile',
      icon: '👁️',
      action: () => navigate('/profile/view'),
      priority: 'secondary'
    },
    {
      title: 'Profile Visibility',
      description: 'Manage who can see your profile',
      icon: '🔒',
      action: () => handleVisibilityToggle(),
      priority: 'secondary'
    },
    {
      title: 'Upload Videos',
      description: 'Add highlight reels and game footage',
      icon: '🎥',
      action: () => toast.info('Video upload coming in Phase 5C'),
      priority: 'secondary'
    }
  ]

  /**
   * 📊 Statistiques spécifiques aux joueurs
   * 
   * Ces métriques aident les joueurs à comprendre leur visibilité
   * et l'intérêt qu'ils génèrent auprès des coachs.
   */
  const playerStats = [
    {
      title: 'Profile Views',
      value: profileStats.views,
      change: '+12%',
      trend: 'up',
      icon: '👁️',
      description: 'This month'
    },
    {
      title: 'Coach Interests',
      value: profileStats.coachInterests,
      change: '+3',
      trend: 'up',
      icon: '🏟️',
      description: 'This week'
    },
    {
      title: 'Profile Completion',
      value: `${profileStats.profileCompletion}%`,
      change: profileStats.profileCompletion >= 80 ? 'Complete' : 'Needs work',
      trend: profileStats.profileCompletion >= 80 ? 'up' : 'down',
      icon: '📋',
      description: 'Completeness score'
    },
    {
      title: 'Last Updated',
      value: profileStats.lastUpdated ? new Date(profileStats.lastUpdated).toLocaleDateString() : 'Never',
      change: 'Keep it fresh',
      trend: 'neutral',
      icon: '📅',
      description: 'Profile updates'
    }
  ]

  /**
   * 🔒 Gestion de la visibilité du profil
   * 
   * Permet aux joueurs de contrôler qui peut voir leur profil.
   */
  const handleVisibilityToggle = async () => {
    try {
      const response = await fetch('/api/players/profile/visibility', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isVisible: !dashboardData?.profile?.isProfileVisible
        })
      })

      if (response.ok) {
        const result = await response.json()
        setDashboardData(prev => ({
          ...prev,
          profile: {
            ...prev.profile,
            isProfileVisible: result.data.isProfileVisible
          }
        }))
        
        toast.success(
          result.data.isProfileVisible 
            ? 'Profile is now visible to coaches' 
            : 'Profile is now private'
        )
      } else {
        throw new Error('Failed to update visibility')
      }
    } catch (error) {
      console.error('❌ Error toggling profile visibility:', error)
      toast.error('Failed to update profile visibility')
    }
  }

  /**
   * 🎨 Actions personnalisées pour l'en-tête
   * 
   * Boutons spécifiques au dashboard joueur affichés dans l'en-tête.
   */
  const customHeaderActions = (
    <div className="header-actions">
      <button
        onClick={() => navigate('/profile/edit')}
        className="btn btn--primary btn--sm"
      >
        ✏️ Edit Profile
      </button>
    </div>
  )

  /**
   * 📱 Interface de chargement
   */
  if (isLoading) {
    return (
      <div className="dashboard dashboard--loading">
        <DashboardHeader 
          title="Player Dashboard" 
          subtitle="Loading your data..."
        />
        <div className="dashboard__loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading your player dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard dashboard--player">
      {/* 📱 En-tête avec navigation et actions */}
      <DashboardHeader
        title="Player Dashboard"
        subtitle={`Welcome back, ${user?.firstName}! Here's your recruitment overview.`}
        customActions={customHeaderActions}
      />

      {/* 📊 Contenu principal du dashboard */}
      <main className="dashboard__main">
        <div className="dashboard__container">
          
          {/* 🎯 Section des statistiques principales */}
          <section className="dashboard__section dashboard__section--stats">
            <DashboardStats 
              title="Your Performance Metrics"
              stats={playerStats}
              type="player"
            />
          </section>

          {/* ⚡ Section des actions rapides */}
          <section className="dashboard__section dashboard__section--actions">
            <QuickActions
              title="Quick Actions"
              actions={playerQuickActions}
              type="player"
            />
          </section>

          {/* 📈 Section de l'activité récente */}
          <section className="dashboard__section dashboard__section--activity">
            <RecentActivity
              title="Recent Activity"
              activities={dashboardData?.recentActivity || []}
              type="player"
            />
          </section>

          {/* 💡 Section des recommandations */}
          <section className="dashboard__section dashboard__section--recommendations">
            <div className="recommendations-card">
              <h3 className="recommendations-card__title">
                💡 Recommendations for You
              </h3>
              <div className="recommendations-card__content">
                {profileStats.profileCompletion < 80 && (
                  <div className="recommendation-item">
                    <span className="recommendation-icon">📋</span>
                    <div className="recommendation-content">
                      <h4>Complete Your Profile</h4>
                      <p>Profiles with 80%+ completion get 3x more views from coaches.</p>
                      <button 
                        onClick={() => navigate('/profile/edit')}
                        className="btn btn--sm btn--outline"
                      >
                        Complete Now
                      </button>
                    </div>
                  </div>
                )}
                
                {profileStats.views < 10 && (
                  <div className="recommendation-item">
                    <span className="recommendation-icon">📈</span>
                    <div className="recommendation-content">
                      <h4>Boost Your Visibility</h4>
                      <p>Add more details and highlight videos to attract coach attention.</p>
                      <button 
                        onClick={() => toast.info('Feature coming in Phase 5C')}
                        className="btn btn--sm btn--outline"
                      >
                        Learn How
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="recommendation-item">
                  <span className="recommendation-icon">🎯</span>
                  <div className="recommendation-content">
                    <h4>Stay Active</h4>
                    <p>Regular profile updates keep you visible to coaches searching for talent.</p>
                    <button 
                      onClick={() => navigate('/profile/edit')}
                      className="btn btn--sm btn--outline"
                    >
                      Update Profile
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default PlayerDashboard