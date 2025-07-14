// client/src/components/common/LoadingSpinner.jsx
import React from 'react'

/**
 * ⏳ Composant LoadingSpinner - Feedback visuel uniforme
 * 
 * Ce composant fournit un feedback visuel cohérent pendant les opérations
 * asynchrones comme la vérification d'authentification ou les appels API.
 * 
 * 🎯 Design pattern : Un seul composant de loading pour toute l'application
 * garantit une expérience utilisateur cohérente et facilite les modifications
 * de style globales.
 */
const LoadingSpinner = ({ 
  message = "Loading...", 
  size = "medium",
  className = "" 
}) => {
  const sizeClasses = {
    small: "spinner-small",
    medium: "spinner-medium", 
    large: "spinner-large"
  }

  return (
    <div className={`loading-spinner ${className}`}>
      <div className={`spinner ${sizeClasses[size]}`}>
        <div className="spinner-circle"></div>
      </div>
      {message && (
        <p className="loading-message">{message}</p>
      )}
    </div>
  )
}

export default LoadingSpinner