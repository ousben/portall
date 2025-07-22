// portall/client/src/pages/dashboard/NJCAACoachDashboard.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import DashboardHeader from '@components/dashboard/DashboardHeader'
import DashboardStats from '@components/dashboard/DashboardStats'
import QuickActions from '@components/dashboard/QuickActions'
import RecentActivity from '@components/dashboard/RecentActivity'
import toast from 'react-hot-toast'

/**
 * 🏫 Dashboard Coach NJCAA - Interface d'Évaluation Phase 5B
 * 
 * Ce dashboard sert les coachs NJCAA qui ont un rôle fundamentalement différent
 * des coachs NCAA/NAIA. Ils sont les "producteurs de données" de l'écosystème,
 * responsables d'évaluer et de promouvoir leurs propres joueurs.
 * 
 * 🎯 Concept pédagogique : "Role-Based Interface Design"
 * Cette interface illustre comment adapter l'expérience utilisateur selon
 * les responsabilités métier spécifiques. Là où les coachs NCAA/NAIA "consomment"
 * des données de joueurs, les coachs NJCAA "produisent" ces données.
 * 
 * 🏗️ Objectifs métier pour les coachs NJCAA :
 * 1. Évaluer et noter leurs joueurs selon des critères standardisés
 * 2. Gérer les profils de leurs joueurs sur la plateforme
 * 3. Suivre les progrès et l'évolution de leurs athlètes
 * 4. Faciliter la visibilité de leurs joueurs auprès des recruteurs
 * 
 * 📊 Différences architecturales clés :
 * - Interface d'évaluation avec formulaires de notation
 * - Gestion de roster (liste des joueurs de l'équipe)
 * - Outils de suivi de progression des joueurs
 * - Metrics de placement et de réussite des anciens joueurs
 * 
 * Cette distinction claire entre "producteurs" et "consommateurs" de données
 * rend le système plus efficace et spécialisé pour chaque type d'utilisateur.
 */
function NJCAACoachDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // États pour la gestion des données spécifiques aux coachs NJCAA
  const [dashboardData, setDashboardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [teamStats, setTeamStats] = useState({
    totalPlayers: 0,
    evaluatedPlayers: 0,
    activeRecruits: 0,
    recentPlacements: 0
  })

  /**
   * 📡 Chargement des données spécifiques aux coachs NJCAA
   * 
   * Cette fonction utilise l'endpoint spécialisé /api/njcaa-coaches/*
   * qui a été développé lors de votre Phase 4 bis.
   */
  useEffect(() => {
    const loadNJCAACoachDashboard = async () => {
      try {
        setIsLoading(true)
        
        console.log('📊 Loading NJCAA coach dashboard data...')
        
        // Appel à votre endpoint spécialisé pour les coachs NJCAA
        const response = await fetch('/api/njcaa-coaches/dashboard', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          setDashboardData(data.data)
          setTeamStats(data.data.teamStats || teamStats)
          
          console.log('✅ NJCAA coach dashboard data loaded successfully')
          console.log('📊 Player evaluation system ready')
        } else {
          throw new Error('Failed to load NJCAA coach dashboard data')
        }
      } catch (error) {
        console.error('❌ Error loading NJCAA coach dashboard:', error)
        toast.error('Failed to load dashboard data')
        
        // Interface de fallback pour assurer la continuité de service
        setDashboardData({
          roster: [],
          recentEvaluations: [],
          pendingEvaluations: []
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadNJCAACoachDashboard()
  }, [])

  /**
   * 🎯 Actions rapides spécifiques aux coachs NJCAA
   * 
   * Ces actions reflètent le workflow d'évaluation et de gestion d'équipe
   * qui est au cœur du rôle des coachs NJCAA dans l'écosystème.
   */
  const njcaaCoachQuickActions = [
    {
      title: 'Evaluate Players',
      description: 'Rate and assess your team members',
      icon: '📝',
      action: () => handlePlayerEvaluation(),
      priority: 'primary'
    },
    {
      title: 'Manage Roster',
      description: 'View and update your team roster',
      icon: '👥',
      action: () => navigate('/roster/manage'),
      priority: 'primary'
    },
    {
      title: 'Player Progress',
      description: 'Track player development over time',
      icon: '📈',
      action: () => navigate('/players/progress'),
      priority: 'secondary'
    },
    {
      title: 'Evaluation History',
      description: 'Review past player assessments',
      icon: '📋',
      action: () => navigate('/evaluations/history'),
      priority: 'secondary'
    },
    {
      title: 'Export Reports',
      description: 'Generate team performance reports',
      icon: '📊',
      action: () => handleExportReports(),
      priority: 'secondary'
    },
    {
      title: 'Update Profile',
      description: 'Maintain your coaching credentials',
      icon: '✏️',
      action: () => navigate('/profile/edit'),
      priority: 'tertiary'
    }
  ]

  /**
   * 📊 Statistiques spécifiques à la gestion d'équipe NJCAA
   * 
   * Ces métriques aident les coachs NJCAA à suivre leur travail d'évaluation
   * et l'impact de leurs efforts sur la visibilité de leurs joueurs.
   */
  const njcaaCoachStats = [
    {
      title: 'Team Size',
      value: teamStats.totalPlayers,
      change: `${teamStats.evaluatedPlayers} evaluated`,
      trend: teamStats.evaluatedPlayers > 0 ? 'up' : 'neutral',
      icon: '👥',
      description: 'Players in roster'
    },
    {
      title: 'Evaluations Complete',
      value: `${Math.round((teamStats.evaluatedPlayers / Math.max(teamStats.totalPlayers, 1)) * 100)}%`,
      change: `${teamStats.evaluatedPlayers}/${teamStats.totalPlayers}`,
      trend: teamStats.evaluatedPlayers === teamStats.totalPlayers ? 'up' : 'down',
      icon: '📝',
      description: 'Assessment progress'
    },
    {
      title: 'Active Recruits',
      value: teamStats.activeRecruits,
      change: 'Being scouted',
      trend: teamStats.activeRecruits > 0 ? 'up' : 'neutral',
      icon: '🎯',
      description: 'Under recruitment'
    },
    {
      title: 'Recent Placements',
      value: teamStats.recentPlacements,
      change: 'This semester',
      trend: teamStats.recentPlacements > 0 ? 'up' : 'neutral',
      icon: '🏆',
      description: 'Successful transfers'
    }
  ]

  /**
   * 📝 Gestion des évaluations de joueurs
   * 
   * Cette fonction centralise l'accès au système d'évaluation qui est
   * la fonctionnalité core des coachs NJCAA.
   */
  const handlePlayerEvaluation = () => {
    console.log('📝 Opening player evaluation interface')
    // En Phase 5C, ceci ouvrira l'interface d'évaluation complète
    toast.info('Advanced player evaluation tools coming in Phase 5C')
    // navigate('/evaluations/new')
  }

  /**
   * 📊 Gestion de l'export de rapports d'équipe
   * 
   * Les coachs NJCAA ont besoin de générer des rapports pour leur administration
   * et pour présenter leurs joueurs aux recruteurs.
   */
  const handleExportReports = () => {
    console.log('📊 Preparing team reports export')
    toast.info('Team reporting functionality coming in Phase 5C')
  }

  /**
   * 🎨 Actions personnalisées pour l'en-tête du dashboard NJCAA
   */
  const customHeaderActions = (
    <div className="header-actions">
      <button
        onClick={handlePlayerEvaluation}
        className="btn btn--primary btn--sm"
      >
        📝 Evaluate Players
      </button>
      <button
        onClick={() => navigate('/roster/manage')}
        className="btn btn--outline btn--sm"
      >
        👥 Manage Roster
      </button>
    </div>
  )

  /**
   * 📱 Interface de chargement pour coachs NJCAA
   */
  if (isLoading) {
    return (
      <div className="dashboard dashboard--loading">
        <DashboardHeader 
          title="NJCAA Coach Dashboard" 
          subtitle="Loading your team management interface..."
        />
        <div className="dashboard__loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading your coaching dashboard...</p>
            <small>📊 Player evaluation system ready</small>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard dashboard--njcaa-coach">
      {/* 📱 En-tête avec navigation et actions spécialisées */}
      <DashboardHeader
        title="NJCAA Coach Dashboard"
        subtitle={`Welcome Coach ${user?.firstName}! Manage your team and evaluate your players.`}
        customActions={customHeaderActions}
      />

      {/* 📊 Contenu principal du dashboard NJCAA coach */}
      <main className="dashboard__main">
        <div className="dashboard__container">
          
          {/* 🎯 Bannière spécialisée pour les coachs NJCAA */}
          <section className="dashboard__section dashboard__section--welcome">
            <div className="welcome-banner welcome-banner--njcaa-coach">
              <div className="welcome-banner__content">
                <h3>🏫 Your NJCAA Team Management Hub</h3>
                <p>
                  Evaluate your players, track their development, and help them gain visibility 
                  with NCAA/NAIA recruiters. Your assessments are crucial for your players' success.
                </p>
                <div className="welcome-banner__features">
                  <span className="feature-badge">✅ Player Evaluation Tools</span>
                  <span className="feature-badge">✅ Progress Tracking</span>
                  <span className="feature-badge">✅ Roster Management</span>
                  <span className="feature-badge">✅ Recruitment Analytics</span>
                </div>
              </div>
            </div>
          </section>

          {/* 📊 Section des statistiques d'équipe */}
          <section className="dashboard__section dashboard__section--stats">
            <DashboardStats 
              title="Your Team Metrics"
              stats={njcaaCoachStats}
              type="njcaa-coach"
            />
          </section>

          {/* ⚡ Section des actions rapides pour coachs NJCAA */}
          <section className="dashboard__section dashboard__section--actions">
            <QuickActions
              title="Team Management Tools"
              actions={njcaaCoachQuickActions}
              type="njcaa-coach"
            />
          </section>

          {/* 📈 Section de l'activité récente */}
          <section className="dashboard__section dashboard__section--activity">
            <RecentActivity
              title="Recent Team Activity"
              activities={dashboardData?.recentEvaluations || []}
              type="njcaa-coach"
            />
          </section>

          {/* 💡 Section des recommandations pour l'évaluation d'équipe */}
          <section className="dashboard__section dashboard__section--recommendations">
            <div className="recommendations-card">
              <h3 className="recommendations-card__title">
                💡 Optimize Your Team Management
              </h3>
              <div className="recommendations-card__content">
                
                <div className="recommendation-item">
                  <span className="recommendation-icon">📝</span>
                  <div className="recommendation-content">
                    <h4>Complete Player Evaluations</h4>
                    <p>Regular evaluations help your players gain visibility and improve their recruitment prospects.</p>
                    <button 
                      onClick={handlePlayerEvaluation}
                      className="btn btn--sm btn--primary"
                    >
                      Start Evaluating
                    </button>
                  </div>
                </div>

                <div className="recommendation-item">
                  <span className="recommendation-icon">👥</span>
                  <div className="recommendation-content">
                    <h4>Update Your Roster</h4>
                    <p>Keep your team roster current to ensure accurate data for recruiters.</p>
                    <button 
                      onClick={() => navigate('/roster/manage')}
                      className="btn btn--sm btn--outline"
                    >
                      Manage Roster
                    </button>
                  </div>
                </div>

                <div className="recommendation-item">
                  <span className="recommendation-icon">📈</span>
                  <div className="recommendation-content">
                    <h4>Track Player Progress</h4>
                    <p>Monitor your players' development over time to provide better guidance and support.</p>
                    <button 
                      onClick={() => navigate('/players/progress')}
                      className="btn btn--sm btn--outline"
                    >
                      View Progress
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

export default NJCAACoachDashboard