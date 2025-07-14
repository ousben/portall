// portall/client/src/components/auth/PublicRoute.jsx

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import LoadingSpinner from '@components/common/LoadingSpinner'

/**
 * 🌍 Composant PublicRoute - Routes accessibles aux utilisateurs non connectés
 * 
 * Ce composant gère les routes publiques comme Login, Register, Landing Page.
 * Il redirige automatiquement les utilisateurs déjà connectés vers leur dashboard
 * approprié, évitant qu'ils voient des pages de connexion inutiles.
 * 
 * 🎯 Analogie pédagogique : C'est comme l'entrée d'un bâtiment. Si vous avez
 * déjà votre badge d'accès (authentifié), le système vous guide directement
 * vers votre bureau (dashboard) au lieu de vous laisser dans le hall d'accueil.
 * 
 * 📋 Paramètres :
 * - children : Le composant à rendre (page publique)
 * - redirectAuthenticated : Où rediriger si déjà connecté (par défaut: dashboard)
 */
const PublicRoute = ({ 
  children, 
  redirectAuthenticated = '/dashboard' 
}) => {
  const { isAuthenticated, user, isLoading } = useAuth()

  /**
   * 🔄 État de chargement - Attendre la vérification d'authentification
   */
  if (isLoading) {
    return (
      <div className="route-loading">
        <LoadingSpinner message="Loading..." />
      </div>
    )
  }

  /**
   * 🔄 Redirection intelligente pour utilisateurs connectés
   * 
   * Si l'utilisateur est déjà connecté, on le redirige vers son dashboard
   * spécialisé plutôt que vers la route générique. Cette logique reproduit
   * exactement le routage intelligent de votre backend.
   */
  if (isAuthenticated && user) {
    console.log(`🔄 User ${user.email} already authenticated, redirecting to dashboard`)
    
    // Redirection spécialisée selon le type d'utilisateur
    const dashboardRoutes = {
      player: '/dashboard/player',
      coach: '/dashboard/coach',
      njcaa_coach: '/dashboard/njcaa-coach',
      admin: '/dashboard/admin'
    }
    
    const targetRoute = dashboardRoutes[user.userType] || redirectAuthenticated
    
    return <Navigate to={targetRoute} replace />
  }

  /**
   * ✅ Utilisateur non connecté - Afficher la page publique
   */
  return children
}

export default PublicRoute