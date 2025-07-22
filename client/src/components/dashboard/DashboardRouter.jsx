// portall/client/src/components/dashboard/DashboardRouter.jsx
import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import LoadingSpinner from '@components/common/LoadingSpinner'

/**
 * 🧭 Routeur Intelligent de Dashboards - Phase 5B
 * 
 * Ce composant illustre un pattern architectural crucial : le routage
 * conditionnel intelligent basé sur les données utilisateur et les règles métier.
 * 
 * 🎯 Concept pédagogique : "Smart Routing"
 * Au lieu d'avoir des routes statiques, nous créons une logique de routage
 * qui s'adapte automatiquement selon le contexte utilisateur. C'est comme
 * un GPS intelligent qui calcule le meilleur itinéraire selon la situation.
 * 
 * 🏗️ Architecture :
 * 1. Vérification de l'état d'authentification
 * 2. Analyse du type d'utilisateur
 * 3. Application des règles de routage métier
 * 4. Redirection vers le dashboard approprié
 * 
 * 🔄 Intégration avec le workflow unifié :
 * Depuis nos modifications récentes, tous les coachs (NCAA/NAIA et NJCAA)
 * arrivent ici après approbation. Le routeur les dirige vers leur dashboard
 * spécialisé selon leur type exact.
 */
function DashboardRouter() {
  const { user, isAuthenticated, isLoading } = useAuth()

  /**
   * 📊 Logging pour le debugging et les analytics
   * 
   * Ce useEffect nous permet de tracer les décisions de routage,
   * ce qui est précieux pour comprendre les patterns d'usage et
   * déboguer les problèmes de navigation.
   */
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      console.log('🧭 DashboardRouter: Intelligent routing initiated', {
        userType: user.userType,
        userName: `${user.firstName} ${user.lastName}`,
        destination: `/dashboard/${getDashboardPath(user.userType)}`,
        workflow: 'unified_v2' // Indicateur du nouveau workflow
      })
    }
  }, [user, isAuthenticated, isLoading])

  /**
   * 🔄 État de chargement avec design cohérent
   * 
   * Pendant la résolution de l'authentification, nous affichons
   * un état de chargement élégant pour éviter les "flashes" 
   * de contenu incorrect.
   */
  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <LoadingSpinner message="Loading your personalized dashboard..." />
      </div>
    )
  }

  /**
   * 🔒 Vérification de sécurité (défense en profondeur)
   * 
   * Cette vérification ne devrait jamais être nécessaire car ce composant
   * est protégé par ProtectedRoute, mais c'est une bonne pratique de
   * sécurité multicouche.
   */
  if (!isAuthenticated || !user) {
    console.log('🚫 DashboardRouter: User not authenticated, redirecting to login')
    return <Navigate to="/login" replace />
  }

  /**
   * 🎯 Logique de routage principale - Le cœur de l'intelligence
   * 
   * Cette fonction détermine vers quel dashboard rediriger l'utilisateur.
   * Elle intègre toutes les règles métier de votre application.
   */
  const getDashboardDestination = () => {
    switch (user.userType) {
      case 'player':
        return '/dashboard/player'
        
      case 'coach':
        // Coach NCAA/NAIA - Workflow unifié désormais
        return '/dashboard/coach'
        
      case 'njcaa_coach':
        // Coach NJCAA - Dashboard spécialisé pour l'évaluation
        return '/dashboard/njcaa-coach'
        
      case 'admin':
        return '/dashboard/admin'
        
      default:
        // Cas d'erreur : type d'utilisateur inconnu
        console.error('❌ Unknown user type:', user.userType)
        return '/unauthorized'
    }
  }

  const destination = getDashboardDestination()
  
  console.log(`📍 Routing ${user.userType} to: ${destination}`)
  
  return <Navigate to={destination} replace />
}

/**
 * 🛠️ Fonction utilitaire pour extraire le chemin du dashboard
 * 
 * Cette fonction peut être utilisée ailleurs dans l'application
 * pour générer des liens vers les dashboards.
 */
export const getDashboardPath = (userType) => {
  const paths = {
    player: 'player',
    coach: 'coach',
    njcaa_coach: 'njcaa-coach',
    admin: 'admin'
  }
  
  return paths[userType] || 'unknown'
}

export default DashboardRouter