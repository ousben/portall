// portall/client/src/pages/dashboard/CoachDashboard.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import DashboardHeader from '@components/dashboard/DashboardHeader'
import DashboardStats from '@components/dashboard/DashboardStats'
import QuickActions from '@components/dashboard/QuickActions'
import RecentActivity from '@components/dashboard/RecentActivity'
import toast from 'react-hot-toast'

/**
 * 🏟️ Dashboard Coach NCAA/NAIA - Interface Unifiée Phase 5B
 * 
 * Ce dashboard représente l'aboutissement de votre modification architecturale récente.
 * Tous les coachs NCAA/NAIA accèdent maintenant à la plateforme sans obligation de paiement,
 * suivant le même workflow simplifié que les coachs NJCAA.
 * 
 * 🎯 Concept pédagogique : "Unified User Experience"
 * Au lieu d'avoir des expériences différentielles selon le statut de paiement,
 * nous créons une expérience cohérente qui met l'accent sur la valeur métier
 * plutôt que sur les restrictions financières.
 * 
 * 🏗️ Objectifs métier pour les coachs NCAA/NAIA :
 * 1. Rechercher et évaluer des joueurs NJCAA talentueux
 * 2. Gérer leurs favoris et prospects
 * 3. Suivre leurs activités de recrutement
 * 4. Maintenir leur profil institutionnel à jour
 * 
 * 📊 Différences avec le dashboard NJCAA Coach :
 * - Focus sur la recherche de talents (consommateurs de données)
 * - Métriques de découverte et d'engagement avec les joueurs
 * - Outils de gestion de prospects et de pipeline de recrutement
 * - Intégration avec les bases de données de joueurs NJCAA
 * 
 * Vs. NJCAA Coaches qui se concentrent sur l'évaluation de leurs propres joueurs.
 */
function CoachDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // États pour la gestion des données du dashboard
  const [dashboardData, setDashboardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [recruitingStats, setRecruitingStats] = useState({
    totalSearches: 0,
    savedPlayers: 0,
    activeProspects: 0,
    lastActivity: null
  })

  /**
   * 📡 Chargement des données spécifiques aux coachs NCAA/NAIA
   * 
   * Cette fonction illustre comment adapter les appels API selon le type d'utilisateur.
   * Les coachs NCAA/NAIA ont besoin de données différentes des joueurs ou des coachs NJCAA.
   */
  useEffect(() => {
    const loadCoachDashboard = async () => {
      try {
        setIsLoading(true)
        
        console.log('📊 Loading NCAA/NAIA coach dashboard data...')
        
        // Appel à votre endpoint spécialisé pour les coachs NCAA/NAIA
        const response = await fetch('/api/coaches/dashboard', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          setDashboardData(data.data)
          setRecruitingStats(data.data.recruitingStats || recruitingStats)
          
          console.log('✅ Coach dashboard data loaded successfully')
          console.log('🎯 Unified workflow active for NCAA/NAIA coach')
        } else {
          throw new Error('Failed to load coach dashboard data')
        }
      } catch (error) {
        console.error('❌ Error loading coach dashboard:', error)
        toast.error('Failed to load dashboard data')
        
        // Interface de fallback pour assurer une expérience utilisateur fluide
        setDashboardData({
          profile: { college: { name: 'Your Institution' } },
          recentActivity: [],
          recommendations: []
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadCoachDashboard()
  }, [])

  /**
   * 🎯 Actions rapides spécifiques aux coachs NCAA/NAIA
   * 
   * Ces actions reflètent le workflow principal des coachs recruteurs :
   * recherche, évaluation, suivi, et gestion des prospects.
   */
  const coachQuickActions = [
    {
      title: 'Search Players',
      description: 'Find NJCAA talent for your program',
      icon: '🔍',
      action: () => handlePlayerSearch(),
      priority: 'primary'
    },
    {
      title: 'My Favorites',
      description: 'Review saved player profiles',
      icon: '⭐',
      action: () => navigate('/players/favorites'),
      priority: 'secondary'
    },
    {
      title: 'Recent Searches',
      description: 'Access your search history',
      icon: '📋',
      action: () => navigate('/search/history'),
      priority: 'secondary'
    },
    {
      title: 'Update Profile',
      description: 'Maintain your coaching profile',
      icon: '✏️',
      action: () => navigate('/profile/edit'),
      priority: 'secondary'
    },
    {
      title: 'Analytics',
      description: 'View recruitment insights',
      icon: '📊',
      action: () => handleAnalytics(),
      priority: 'secondary'
    },
    {
      title: 'Export Data',
      description: 'Download prospect reports',
      icon: '📥',
      action: () => handleExport(),
      priority: 'tertiary'
    }
  ]

  /**
   * 📊 Statistiques de recrutement pour coachs NCAA/NAIA
   * 
   * Ces métriques aident les coachs à suivre leur activité de recrutement
   * et à optimiser leur processus de découverte de talents.
   */
  const coachStats = [
    {
      title: 'Player Searches',
      value: recruitingStats.totalSearches,
      change: '+8 this week',
      trend: 'up',
      icon: '🔍',
      description: 'Search activity'
    },
    {
      title: 'Saved Players',
      value: recruitingStats.savedPlayers,
      change: '+3 new',
      trend: 'up',
      icon: '⭐',
      description: 'In your favorites'
    },
    {
      title: 'Active Prospects',
      value: recruitingStats.activeProspects,
      change: 'Under review',
      trend: 'neutral',
      icon: '🎯',
      description: 'Being evaluated'
    },
    {
      title: 'Last Activity',
      value: recruitingStats.lastActivity ? 
        new Date(recruitingStats.lastActivity).toLocaleDateString() : 'Today',
      change: 'Stay active',
      trend: 'neutral',
      icon: '📅',
      description: 'Platform usage'
    }
  ]

  /**
   * 🔍 Gestion de la recherche de joueurs
   * 
   * Cette fonction prépare le terrain pour les fonctionnalités avancées
   * de recherche qui seront implémentées en Phase 5C.
   */
  const handlePlayerSearch = () => {
    console.log('🔍 Initiating player search for NCAA/NAIA coach')
    // Pour l'instant, redirection vers une page de préparation
    // En Phase 5C, ceci ouvrira l'interface de recherche avancée
    toast.info('Advanced player search coming in Phase 5C')
    // navigate('/players/search')
  }

  /**
   * 📊 Gestion des analytics de recrutement
   * 
   * Les coachs NCAA/NAIA ont besoin d'insights sur leur activité de recrutement
   * pour optimiser leur stratégie et leurs efforts.
   */
  const handleAnalytics = () => {
    console.log('📊 Opening recruitment analytics for coach')
    toast.info('Detailed analytics dashboard coming in Phase 5C')
    // navigate('/analytics/recruitment')
  }

  /**
   * 📥 Gestion de l'export de données
   * 
   * Fonctionnalité importante pour les coachs qui ont besoin de partager
   * des informations avec leur staff ou leur administration.
   */
  const handleExport = () => {
    console.log('📥 Preparing data export for coach')
    toast.info('Data export functionality coming in Phase 5C')
  }

  /**
   * 🎨 Actions personnalisées pour l'en-tête du dashboard coach
   */
  const customHeaderActions = (
    <div className="header-actions">
      <button
        onClick={handlePlayerSearch}
        className="btn btn--primary btn--sm"
      >
        🔍 Search Players
      </button>
      <button
        onClick={() => navigate('/players/favorites')}
        className="btn btn--outline btn--sm"
      >
        ⭐ Favorites
      </button>
    </div>
  )

  /**
   * 📱 Interface de chargement avec indication du workflow unifié
   */
  if (isLoading) {
    return (
      <div className="dashboard dashboard--loading">
        <DashboardHeader 
          title="Coach Dashboard" 
          subtitle="Loading your unified coaching interface..."
        />
        <div className="dashboard__loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading your coach dashboard...</p>
            <small>🎯 Unified workflow - No payment required</small>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard dashboard--coach">
      {/* 📱 En-tête avec navigation et actions spécialisées */}
      <DashboardHeader
        title="Coach Dashboard"
        subtitle={`Welcome ${user?.firstName}! Your unified recruitment platform is ready.`}
        customActions={customHeaderActions}
      />

      {/* 📊 Contenu principal du dashboard coach */}
      <main className="dashboard__main">
        <div className="dashboard__container">
          
          {/* 🎉 Bannière de bienvenue pour le workflow unifié */}
          <section className="dashboard__section dashboard__section--welcome">
            <div className="welcome-banner welcome-banner--coach">
              <div className="welcome-banner__content">
                <h3>🎉 Welcome to Your Unified Coaching Experience</h3>
                <p>
                  Your account has been approved and you now have full access to our recruitment platform. 
                  Search for talented NJCAA players, manage your prospects, and build your team with our comprehensive tools.
                </p>
                <div className="welcome-banner__features">
                  <span className="feature-badge">✅ Full Player Database Access</span>
                  <span className="feature-badge">✅ Advanced Search Tools</span>
                  <span className="feature-badge">✅ Prospect Management</span>
                  <span className="feature-badge">✅ No Payment Required</span>
                </div>
              </div>
            </div>
          </section>

          {/* 📊 Section des statistiques de recrutement */}
          <section className="dashboard__section dashboard__section--stats">
            <DashboardStats 
              title="Your Recruitment Metrics"
              stats={coachStats}
              type="coach"
            />
          </section>

          {/* ⚡ Section des actions rapides pour coachs */}
          <section className="dashboard__section dashboard__section--actions">
            <QuickActions
              title="Recruitment Tools"
              actions={coachQuickActions}
              type="coach"
            />
          </section>

          {/* 📈 Section de l'activité récente */}
          <section className="dashboard__section dashboard__section--activity">
            <RecentActivity
              title="Recent Recruitment Activity"
              activities={dashboardData?.recentActivity || []}
              type="coach"
            />
          </section>

          {/* 💡 Section des recommandations pour optimiser le recrutement */}
          <section className="dashboard__section dashboard__section--recommendations">
            <div className="recommendations-card">
              <h3 className="recommendations-card__title">
                💡 Optimize Your Recruitment Strategy
              </h3>
              <div className="recommendations-card__content">
                
                <div className="recommendation-item">
                  <span className="recommendation-icon">🔍</span>
                  <div className="recommendation-content">
                    <h4>Start Your First Search</h4>
                    <p>Use our advanced filters to find players that match your program's needs and playing style.</p>
                    <button 
                      onClick={handlePlayerSearch}
                      className="btn btn--sm btn--primary"
                    >
                      Search Now
                    </button>
                  </div>
                </div>

                <div className="recommendation-item">
                  <span className="recommendation-icon">⭐</span>
                  <div className="recommendation-content">
                    <h4>Build Your Favorites List</h4>
                    <p>Save promising players to your favorites for easy access and follow-up.</p>
                    <button 
                      onClick={() => navigate('/players/favorites')}
                      className="btn btn--sm btn--outline"
                    >
                      View Favorites
                    </button>
                  </div>
                </div>

                <div className="recommendation-item">
                  <span className="recommendation-icon">📋</span>
                  <div className="recommendation-content">
                    <h4>Complete Your Coach Profile</h4>
                    <p>A complete profile helps players understand your program and coaching philosophy.</p>
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

export default CoachDashboard