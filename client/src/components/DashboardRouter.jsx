// portall/client/src/components/DashboardRouter.jsx

import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'

/**
 * Routeur intelligent pour les dashboards
 * 
 * Ce composant illustre un pattern architectural important : le routage
 * conditionnel basé sur les données utilisateur. Au lieu d'avoir des routes
 * statiques, nous créons une logique de routage dynamique.
 * 
 * Concepts pédagogiques :
 * 
 * 1. Smart Routing : Le routage s'adapte automatiquement selon le contexte
 * 2. User Experience : L'utilisateur arrive toujours sur la bonne page
 * 3. Separation of Concerns : La logique de routage est isolée du contenu
 * 4. Maintainability : Facile d'ajouter de nouveaux types d'utilisateurs
 * 
 * Analogie : C'est comme un réceptionniste intelligent dans un hôtel qui
 * dirige automatiquement chaque client vers le bon type de chambre selon
 * ses besoins et son statut.
 */
function DashboardRouter() {
  const { user, isAuthenticated, isLoading } = useAuth()

  // Effet de debugging pour tracer les décisions de routage
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      console.log('🧭 DashboardRouter: Routing user to appropriate dashboard', {
        userType: user.userType,
        userName: `${user.firstName} ${user.lastName}`,
        destination: `/dashboard/${user.userType}`
      })
    }
  }, [user, isAuthenticated, isLoading])

  /**
   * État de chargement : Afficher un indicateur pendant la résolution
   * 
   * Pendant que nous déterminons où rediriger l'utilisateur, nous affichons
   * un état de chargement pour éviter les "flashes" de contenu incorrect.
   */
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Loading your dashboard...
          </p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  /**
   * Sécurité : Vérifier l'authentification
   * 
   * Cette vérification ne devrait jamais être nécessaire car ce composant
   * est protégé par ProtectedRoute, mais c'est une bonne pratique de
   * défense en profondeur.
   */
  if (!isAuthenticated || !user) {
    console.log('🚫 DashboardRouter: User not authenticated, redirecting to login')
    return <Navigate to="/login" replace />
  }

  /**
   * Logique de routage principal : Redirection basée sur le type d'utilisateur
   * 
   * Cette fonction centrale détermine vers quel dashboard rediriger
   * l'utilisateur selon son type. C'est ici que la "magie" opère.
   */
  switch (user.userType) {
    case 'player':
      console.log('📍 Routing to player dashboard')
      return <Navigate to="/dashboard/player" replace />
      
    case 'coach':
      console.log('📍 Routing to coach dashboard')
      return <Navigate to="/dashboard/coach" replace />
      
    case 'admin':
      console.log('📍 Routing to admin dashboard (future implementation)')
      // Pour l'instant, rediriger vers une page temporaire
      // En Phase 4, nous créerons un vrai dashboard admin
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#f8fafc',
          padding: '2rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
            maxWidth: '500px'
          }}>
            <h2 style={{ color: '#2563eb', margin: '0 0 1rem 0' }}>
              👋 Welcome, Admin {user.firstName}!
            </h2>
            <p style={{ color: '#6b7280', margin: '0 0 1.5rem 0' }}>
              Your admin dashboard is coming in Phase 4. For now, you can access
              the admin panel through your existing routes.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <a 
                href="/admin/dashboard"
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  display: 'inline-block'
                }}
              >
                🔧 Admin Panel
              </a>
              <a 
                href="/"
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  display: 'inline-block'
                }}
              >
                🏠 Home
              </a>
            </div>
          </div>
        </div>
      )
      
    default:
      /**
       * Cas d'erreur : Type d'utilisateur inconnu
       * 
       * Cette situation ne devrait jamais arriver en théorie, mais
       * c'est important de gérer les cas d'erreur pour la robustesse.
       */
      console.error('❌ DashboardRouter: Unknown user type:', user.userType)
      
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#f8fafc',
          padding: '2rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
            maxWidth: '400px'
          }}>
            <h2 style={{ color: '#dc2626', margin: '0 0 1rem 0' }}>
              ⚠️ Configuration Error
            </h2>
            <p style={{ color: '#6b7280', margin: '0 0 1.5rem 0' }}>
              Unknown user type: {user.userType}. Please contact support.
            </p>
            <a 
              href="/"
              style={{
                backgroundColor: '#2563eb',
                color: 'white',
                textDecoration: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                display: 'inline-block'
              }}
            >
              🏠 Go Home
            </a>
          </div>
        </div>
      )
  }
}

export default DashboardRouter