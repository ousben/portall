// portall/client/src/pages/UnauthorizedPage.jsx

import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'

/**
 * 🚫 Page d'Accès Non Autorisé - Guidance Constructive
 * 
 * Cette page transforme un moment de frustration en opportunité d'orientation.
 * Au lieu de simplement bloquer l'utilisateur, elle explique le problème et
 * propose des solutions concrètes.
 */
const UnauthorizedPage = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="error-page">
      <div className="error-container">
        <div className="error-illustration unauthorized unauthorized-animation">
          🔒
        </div>
        
        <div className="error-content">
          <h1>Access Restricted</h1>
          <p>
            You don't have permission to access this page. This could be because 
            your account type doesn't have the required privileges, or your session 
            may have expired.
          </p>
        </div>

        <div className="error-suggestions">
          <h3>What you can do:</h3>
          <ul className="suggestion-list">
            <li className="suggestion-item">
              <Link to="/dashboard">Go to your dashboard</Link>
            </li>
            {user && (
              <li className="suggestion-item">
                <button onClick={handleLogout} className="link-style">
                  Sign out and sign back in
                </button>
              </li>
            )}
            <li className="suggestion-item">
              <button onClick={handleGoBack} className="link-style">
                Go back to previous page
              </button>
            </li>
            <li className="suggestion-item">
              <a href="mailto:support@portall.com">Contact support for help</a>
            </li>
          </ul>
        </div>

        <div className="error-actions">
          <Link to="/dashboard" className="error-button primary">
            Go to Dashboard
          </Link>
          <button onClick={handleGoBack} className="error-button secondary">
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}

export default UnauthorizedPage