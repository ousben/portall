// portall/client/src/pages/NotFoundPage.jsx

import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

/**
 * 🔍 Page 404 - Redirection Élégante vers les Contenus Utiles
 * 
 * Cette page transforme un cul-de-sac en pont vers les fonctionnalités
 * principales de Portall. L'approche est orientée solution plutôt que problème.
 */
const NotFoundPage = () => {
  const navigate = useNavigate()

  const handleGoBack = () => {
    navigate(-1)
  }

  return (
    <div className="error-page">
      <div className="error-container">
        <div className="error-illustration not-found not-found-animation">
          <span className="error-code">404</span>
        </div>
        
        <div className="error-content">
          <h1>Page Not Found</h1>
          <p>
            Looks like this page decided to transfer to another league! 
            Don't worry, we'll help you find what you're looking for.
          </p>
        </div>

        <div className="error-suggestions">
          <h3>Popular destinations:</h3>
          <ul className="suggestion-list">
            <li className="suggestion-item">
              <Link to="/">Visit our homepage</Link>
            </li>
            <li className="suggestion-item">
              <Link to="/login">Sign in to your account</Link>
            </li>
            <li className="suggestion-item">
              <Link to="/register">Create a new account</Link>
            </li>
            <li className="suggestion-item">
              <button onClick={handleGoBack} className="link-style">
                Go back to previous page
              </button>
            </li>
          </ul>
        </div>

        <div className="error-actions">
          <Link to="/" className="error-button primary">
            Go Home
          </Link>
          <button onClick={handleGoBack} className="error-button secondary">
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage