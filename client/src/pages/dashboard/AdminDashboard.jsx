// portall/client/src/pages/dashboard/AdminDashboard.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import DashboardHeader from '@components/dashboard/DashboardHeader'
import DashboardStats from '@components/dashboard/DashboardStats'
import QuickActions from '@components/dashboard/QuickActions'
import RecentActivity from '@components/dashboard/RecentActivity'
import toast from 'react-hot-toast'

/**
 * 🛡️ Dashboard Administrateur - Centre de Contrôle Phase 5B
 * 
 * Ce dashboard sert les administrateurs qui supervisent l'ensemble de la plateforme.
 * Il intègre parfaitement les modifications récentes du workflow unifié pour les coachs
 * et fournit une vue d'ensemble de l'état de santé de l'écosystème.
 * 
 * 🎯 Concept pédagogique : "Administrative Oversight Interface"
 * Cette interface illustre comment concevoir un tableau de bord pour les utilisateurs
 * qui ont besoin d'une vue d'ensemble et de contrôles administratifs sur un système complexe.
 * 
 * 🏗️ Responsabilités administratives clés :
 * 1. Validation et approbation des nouveaux comptes utilisateurs
 * 2. Supervision de l'activité de la plateforme
 * 3. Gestion des problèmes et du support utilisateur
 * 4. Surveillance des métriques de santé du système
 * 5. Configuration et maintenance de la plateforme
 * 
 * 📊 Intégration du workflow unifié :
 * Le dashboard reflète les changements récents où tous les coachs suivent
 * maintenant le même processus d'approbation, simplifiant la gestion administrative.
 */
function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // États pour la gestion des données administratives
  const [dashboardData, setDashboardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [systemStats, setSystemStats] = useState({
    pendingApprovals: 0,
    totalUsers: 0,
    activeCoaches: 0,
    activePlayers: 0,
    systemHealth: 'healthy'
  })

  /**
   * 📡 Chargement des données administratives globales
   * 
   * Cette fonction récupère toutes les métriques nécessaires pour donner
   * aux administrateurs une vue d'ensemble de l'état de la plateforme.
   */
  useEffect(() => {
    const loadAdminDashboard = async () => {
      try {
        setIsLoading(true)
        
        console.log('🛡️ Loading admin dashboard data...')
        
        // Appel à votre endpoint administratif
        const response = await fetch('/api/admin/dashboard', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          setDashboardData(data.data)
          setSystemStats(data.data.overview || systemStats)
          
          console.log('✅ Admin dashboard data loaded successfully')
          console.log('🎯 Unified workflow statistics updated')
        } else {
          throw new Error('Failed to load admin dashboard data')
        }
      } catch (error) {
        console.error('❌ Error loading admin dashboard:', error)
        toast.error('Failed to load dashboard data')
        
        // Interface de fallback pour assurer la continuité administrative
        setDashboardData({
          recentActivity: [],
          pendingUsers: [],
          systemAlerts: []
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadAdminDashboard()
  }, [])

  /**
   * 🎯 Actions rapides spécifiques aux administrateurs
   * 
   * Ces actions donnent accès aux fonctionnalités critiques de gestion
   * de la plateforme et de support aux utilisateurs.
   */
  const adminQuickActions = [
    {
      title: 'Pending Approvals',
      description: `${systemStats.pendingApprovals} accounts awaiting review`,
      icon: '⏳',
      action: () => navigate('/admin/approvals'),
      priority: 'primary',
      badge: systemStats.pendingApprovals > 0 ? systemStats.pendingApprovals : null
    },
    {
      title: 'User Management',
      description: 'Manage all platform users',
      icon: '👥',
      action: () => navigate('/admin/users'),
      priority: 'primary'
    },
    {
      title: 'System Health',
      description: 'Monitor platform performance',
      icon: '🩺',
      action: () => handleSystemHealth(),
      priority: 'secondary'
    },
    {
      title: 'Analytics',
      description: 'Platform usage insights',
      icon: '📊',
      action: () => navigate('/admin/analytics'),
      priority: 'secondary'
    },
    {
      title: 'Support Tickets',
      description: 'Handle user support requests',
      icon: '🎧',
      action: () => navigate('/admin/support'),
      priority: 'secondary'
    },
    {
      title: 'Configuration',
      description: 'Platform settings and config',
      icon: '⚙️',
      action: () => navigate('/admin/config'),
      priority: 'tertiary'
    }
  ]

  /**
   * 📊 Statistiques administratives globales
   * 
   * Ces métriques donnent aux administrateurs une vue d'ensemble rapide
   * de l'état de la plateforme et des actions requises.
   */
  const adminStats = [
    {
      title: 'Pending Approvals',
      value: systemStats.pendingApprovals,
      change: systemStats.pendingApprovals > 5 ? 'Needs attention' : 'Under control',
      trend: systemStats.pendingApprovals > 5 ? 'down' : 'up',
      icon: '⏳',
      description: 'Awaiting review',
      urgent: systemStats.pendingApprovals > 10
    },
    {
      title: 'Total Users',
      value: systemStats.totalUsers,
      change: '+12 this week',
      trend: 'up',
      icon: '👥',
      description: 'Platform members'
    },
    {
      title: 'Active Coaches',
      value: systemStats.activeCoaches,
      change: 'Unified workflow',
      trend: 'up',
      icon: '🏟️',
      description: 'All types combined'
    },
    {
      title: 'System Health',
      value: systemStats.systemHealth === 'healthy' ? '99.9%' : 'Issues',
      change: systemStats.systemHealth === 'healthy' ? 'All systems operational' : 'Requires attention',
      trend: systemStats.systemHealth === 'healthy' ? 'up' : 'down',
      icon: '🩺',
      description: 'Uptime status'
    }
  ]

  /**
   * 🩺 Gestion de la santé système
   * 
   * Cette fonction permet aux administrateurs de vérifier rapidement
   * l'état de tous les composants critiques de la plateforme.
   */
  const handleSystemHealth = () => {
    console.log('🩺 Checking comprehensive system health...')
    toast.info('System health monitoring dashboard coming in Phase 5C')
    // navigate('/admin/health')
  }

  /**
   * ⚡ Gestion des approbations en masse
   * 
   * Fonctionnalité pour traiter efficacement plusieurs approbations,
   * particulièrement utile avec le workflow unifié simplifié.
   */
  const handleBulkApprovals = () => {
    console.log('⚡ Opening bulk approval interface...')
    toast.info('Bulk approval tools coming in Phase 5C')
  }

  /**
   * 🎨 Actions personnalisées pour l'en-tête admin
   */
  const customHeaderActions = (
    <div className="header-actions">
      <button
        onClick={() => navigate('/admin/approvals')}
        className={`btn btn--sm ${systemStats.pendingApprovals > 0 ? 'btn--primary' : 'btn--outline'}`}
      >
        ⏳ Approvals {systemStats.pendingApprovals > 0 && `(${systemStats.pendingApprovals})`}
      </button>
      <button
        onClick={() => navigate('/admin/users')}
        className="btn btn--outline btn--sm"
      >
        👥 Users
      </button>
    </div>
  )

  /**
   * 📱 Interface de chargement administrative
   */
  if (isLoading) {
    return (
      <div className="dashboard dashboard--loading">
        <DashboardHeader 
          title="Admin Dashboard" 
          subtitle="Loading system overview..."
        />
        <div className="dashboard__loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading administrative dashboard...</p>
            <small>🛡️ Unified workflow management ready</small>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard dashboard--admin">
      {/* 📱 En-tête avec navigation et actions administratives */}
      <DashboardHeader
        title="Admin Dashboard"
        subtitle={`Welcome ${user?.firstName}! Manage your unified platform with simplified workflows.`}
        customActions={customHeaderActions}
      />

      {/* 📊 Contenu principal du dashboard admin */}
      <main className="dashboard__main">
        <div className="dashboard__container">
          
          {/* 🎯 Bannière de statut du workflow unifié */}
          <section className="dashboard__section dashboard__section--welcome">
            <div className="welcome-banner welcome-banner--admin">
              <div className="welcome-banner__content">
                <h3>🛡️ Unified Platform Management</h3>
                <p>
                  Your platform is now running the unified workflow where all coaches follow the same 
                  approval process. This simplifies administration and improves user experience.
                </p>
                <div className="welcome-banner__features">
                  <span className="feature-badge">✅ Simplified Approval Workflow</span>
                  <span className="feature-badge">✅ Unified Coach Experience</span>
                  <span className="feature-badge">✅ Reduced Complexity</span>
                  <span className="feature-badge">✅ Better User Adoption</span>
                </div>
              </div>
            </div>
          </section>

          {/* 📊 Section des statistiques système */}
          <section className="dashboard__section dashboard__section--stats">
            <DashboardStats 
              title="Platform Overview"
              stats={adminStats}
              type="admin"
            />
          </section>

          {/* ⚡ Section des actions administratives */}
          <section className="dashboard__section dashboard__section--actions">
            <QuickActions
              title="Administrative Tools"
              actions={adminQuickActions}
              type="admin"
            />
          </section>

          {/* 📈 Section de l'activité récente */}
          <section className="dashboard__section dashboard__section--activity">
            <RecentActivity
              title="Recent Platform Activity"
              activities={dashboardData?.recentActivity || []}
              type="admin"
            />
          </section>

          {/* 💡 Section des recommandations administratives */}
          <section className="dashboard__section dashboard__section--recommendations">
            <div className="recommendations-card">
              <h3 className="recommendations-card__title">
                💡 Platform Management Priorities
              </h3>
              <div className="recommendations-card__content">
                
                {systemStats.pendingApprovals > 0 && (
                  <div className="recommendation-item recommendation-item--urgent">
                    <span className="recommendation-icon">⚠️</span>
                    <div className="recommendation-content">
                      <h4>Process Pending Approvals</h4>
                      <p>{systemStats.pendingApprovals} accounts are waiting for approval. Quick action improves user experience.</p>
                      <button 
                        onClick={() => navigate('/admin/approvals')}
                        className="btn btn--sm btn--primary"
                      >
                        Review Now ({systemStats.pendingApprovals})
                      </button>
                    </div>
                  </div>
                )}

                <div className="recommendation-item">
                  <span className="recommendation-icon">📊</span>
                  <div className="recommendation-content">
                    <h4>Monitor Unified Workflow Impact</h4>
                    <p>Track how the simplified coach workflow affects user adoption and satisfaction.</p>
                    <button 
                      onClick={() => navigate('/admin/analytics')}
                      className="btn btn--sm btn--outline"
                    >
                      View Analytics
                    </button>
                  </div>
                </div>

                <div className="recommendation-item">
                  <span className="recommendation-icon">🩺</span>
                  <div className="recommendation-content">
                    <h4>System Health Check</h4>
                    <p>Regular monitoring ensures optimal performance for all users.</p>
                    <button 
                      onClick={handleSystemHealth}
                      className="btn btn--sm btn--outline"
                    >
                      Check Health
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

export default AdminDashboard