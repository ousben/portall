// portall/client/src/components/auth/ProtectedRoute.jsx
import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import LoadingSpinner from '@components/common/LoadingSpinner'

/**
 * 🛡️ Composant ProtectedRoute - Garde de sécurité pour les routes privées
 * 
 * Ce composant reproduit fidèlement la logique de vos middlewares backend
 * `authenticate` et `authorize`. Il vérifie que l'utilisateur est connecté
 * ET qu'il a les bonnes permissions pour accéder à une route spécifique.
 * 
 * 🎯 Analogie pédagogique : Pensez à ce composant comme un videur de boîte de nuit.
 * Il vérifie d'abord que vous avez une carte d'identité valide (isAuthenticated),
 * puis que vous êtes sur la liste VIP appropriée (userType autorisé).
 * 
 * 📋 Paramètres :
 * - children : Le composant à rendre si l'accès est autorisé
 * - allowedUserTypes : Array des types d'utilisateurs autorisés (optionnel)
 * - requiredPermissions : Permissions spécifiques requises (pour évolutions futures)
 */
const ProtectedRoute = ({ 
  children, 
  allowedUserTypes = null, 
  requiredPermissions = null,
  redirectTo = '/login' 
}) => {
  const { isAuthenticated, user, isLoading } = useAuth()
  const location = useLocation()

  /**
   * 🔄 État de chargement - Attendre la vérification d'authentification
   * 
   * Pendant que le AuthContext vérifie l'état d'authentification au démarrage,
   * on affiche un spinner pour éviter les redirections prématurées.
   */
  if (isLoading) {
    return (
      <div className="route-loading">
        <LoadingSpinner message="Verifying authentication..." />
      </div>
    )
  }

  /**
   * 🚫 Vérification 1 : Utilisateur non authentifié
   * 
   * Si pas d'authentification, rediriger vers login en préservant
   * l'URL de destination pour redirection post-login.
   */
  if (!isAuthenticated || !user) {
    console.log('🚫 Access denied: User not authenticated')
    
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location.pathname }} 
        replace 
      />
    )
  }

  /**
   * 🎯 Vérification 2 : Type d'utilisateur autorisé
   * 
   * Si des types spécifiques sont requis, vérifier que l'utilisateur
   * correspond. Cette logique reproduit exactement votre middleware
   * `authorize` backend.
   */
  if (allowedUserTypes && !allowedUserTypes.includes(user.userType)) {
    console.log(`🚫 Access denied: User type ${user.userType} not in allowed types:`, allowedUserTypes)
    
    return <Navigate to="/unauthorized" replace />
  }

  /**
   * 🔐 Vérification 3 : Permissions spécifiques (pour évolutions futures)
   * 
   * Cette section est préparée pour un système de permissions plus granulaire
   * que vous pourriez ajouter plus tard (comme les rôles dans Stripe).
   */
  if (requiredPermissions && user.permissions) {
    const hasRequiredPermissions = requiredPermissions.every(permission =>
      user.permissions.includes(permission)
    )

    if (!hasRequiredPermissions) {
      console.log('🚫 Access denied: Insufficient permissions')
      return <Navigate to="/unauthorized" replace />
    }
  }

  /**
   * ✅ Toutes les vérifications passées - Autoriser l'accès
   * 
   * L'utilisateur est authentifié ET autorisé, on peut rendre le composant enfant.
   */
  console.log(`✅ Access granted for user ${user.email} (${user.userType})`)
  
  return children
}

export default ProtectedRoute