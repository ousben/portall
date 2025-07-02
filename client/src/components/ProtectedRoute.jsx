// portall/client/src/components/ProtectedRoute.jsx

import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'

/**
 * Composant de protection des routes
 * 
 * Ce composant illustre un pattern de sécurité fondamental dans les applications
 * React : la protection basée sur les rôles et l'authentification.
 * 
 * Concepts pédagogiques importants :
 * 
 * 1. Higher-Order Component (HOC) Pattern : Ce composant "enveloppe" d'autres
 *    composants pour leur ajouter une fonctionnalité (ici la protection)
 * 
 * 2. Conditional Rendering : L'affichage est conditionnel selon l'état d'auth
 * 
 * 3. Route Guards : Pattern de sécurité où on vérifie les permissions avant
 *    d'afficher le contenu protégé
 * 
 * 4. State Management Integration : Utilisation du context d'auth pour
 *    centraliser la logique de sécurité
 * 
 * @param {Object} props - Props du composant
 * @param {React.ReactNode} props.children - Contenu à protéger
 * @param {string} props.requiredUserType - Type d'utilisateur requis (optionnel)
 * @param {Array<string>} props.allowedUserTypes - Types d'utilisateurs autorisés (optionnel)
 */
function ProtectedRoute({ 
  children, 
  requiredUserType = null, 
  allowedUserTypes = null 
}) {
  const { user, isAuthenticated, isLoading, isInitialized } = useAuth()
  const location = useLocation()

  // Effet de debugging pour tracer les vérifications de sécurité
  useEffect(() => {
    if (isInitialized && !isLoading) {
      console.log('🛡️ ProtectedRoute check:', {
        isAuthenticated,
        userType: user?.userType,
        requiredUserType,
        allowedUserTypes,
        path: location.pathname
      })
    }
  }, [isAuthenticated, user?.userType, requiredUserType, allowedUserTypes, location.pathname, isInitialized, isLoading])

  /**
   * Première vérification : Attendre l'initialisation du système d'auth
   * 
   * Cette étape est cruciale car elle évite les "flash" d'états incorrects
   * pendant que le système vérifie l'état d'authentification.
   */
  if (!isInitialized || isLoading) {
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
            Loading Portall...
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
   * Deuxième vérification : Authentification de base
   * 
   * Si l'utilisateur n'est pas connecté, le rediriger vers la page de login
   * en conservant l'URL de destination pour redirection post-login.
   */
  if (!isAuthenticated) {
    console.log('🚫 Access denied - User not authenticated, redirecting to login')
    
    return (
      <Navigate 
        to="/login" 
        state={{ from: location }} 
        replace 
      />
    )
  }

  /**
   * Troisième vérification : Validation du type d'utilisateur spécifique
   * 
   * Cette vérification permet de créer des routes accessibles seulement
   * à certains types d'utilisateurs (ex: pages admin).
   */
  if (requiredUserType && user.userType !== requiredUserType) {
    console.log(`🚫 Access denied - Required type: ${requiredUserType}, User type: ${user.userType}`)
    
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
            🚫 Access Denied
          </h2>
          <p style={{ color: '#6b7280', margin: '0 0 1.5rem 0' }}>
            This page is only accessible to {requiredUserType}s.
          </p>
          <button 
            onClick={() => window.history.back()}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ← Go Back
          </button>
        </div>
      </div>
    )
  }

  /**
   * Quatrième vérification : Validation des types d'utilisateurs autorisés
   * 
   * Cette vérification plus flexible permet d'autoriser plusieurs types
   * d'utilisateurs (ex: ['player', 'coach'] pour une page accessible aux deux).
   */
  if (allowedUserTypes && !allowedUserTypes.includes(user.userType)) {
    console.log(`🚫 Access denied - Allowed types: ${allowedUserTypes.join(', ')}, User type: ${user.userType}`)
    
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
            🚫 Access Denied
          </h2>
          <p style={{ color: '#6b7280', margin: '0 0 1.5rem 0' }}>
            This page is only accessible to {allowedUserTypes.join(' and ')}s.
          </p>
          <button 
            onClick={() => window.history.back()}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ← Go Back
          </button>
        </div>
      </div>
    )
  }

  /**
   * Toutes les vérifications passées : Afficher le contenu protégé
   * 
   * Si nous arrivons ici, l'utilisateur est authentifié et autorisé
   * à voir le contenu. Nous retournons les children (contenu protégé).
   */
  console.log('✅ Access granted - Rendering protected content')
  return children
}

export default ProtectedRoute