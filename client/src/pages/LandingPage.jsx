// portall/client/src/pages/LandingPage.jsx

import { Link } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext' // NOUVEAU : Import du context d'auth
import './LandingPage.css'

function LandingPage() {
  // NOUVEAU : Utilisation du context d'auth pour personnaliser l'affichage
  const { user, isAuthenticated } = useAuth()

  return (
    <div className="landing-page">
      <header className="landing-header">
        <nav className="nav-container">
          <div className="logo">
            <h1>Portall</h1>
          </div>
          <div className="nav-links">
            {/* LOGIQUE MISE À JOUR : Affichage conditionnel selon l'état d'authentification */}
            {isAuthenticated ? (
              // Si l'utilisateur est connecté, afficher le lien vers son dashboard
              <>
                <span style={{ 
                  color: 'var(--color-gray-600)', 
                  fontSize: 'var(--font-size-sm)',
                  marginRight: 'var(--spacing-md)'
                }}>
                  Welcome back, {user?.firstName}!
                </span>
                <Link to="/dashboard" className="btn btn-primary">
                  Go to Dashboard
                </Link>
              </>
            ) : (
              // Si l'utilisateur n'est pas connecté, afficher les liens de connexion/inscription
              <>
                <Link to="/login" className="btn btn-secondary">Login</Link>
                <Link to="/signup" className="btn btn-primary">Sign Up</Link>
              </>
            )}
          </div>
        </nav>
      </header>
      
      <main>
        <section className="hero">
          <div className="hero-content">
            <h2>Connect Your Soccer Journey</h2>
            <p>The premier platform connecting NJCAA soccer players with NCAA and NAIA opportunities</p>
            
            {/* LOGIQUE MISE À JOUR : Call-to-action adaptatif */}
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-primary btn-large">
                Access Your Dashboard
              </Link>
            ) : (
              <Link to="/signup" className="btn btn-primary btn-large">
                Get Started
              </Link>
            )}
          </div>
        </section>

        {/* NOUVELLE SECTION : Témoignages et fonctionnalités pour enrichir la landing page */}
        <section className="features-section">
          <div className="container">
            <h3>Why Choose Portall?</h3>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">👥</div>
                <h4>Direct Connection</h4>
                <p>Connect directly with NCAA and NAIA coaches actively seeking talent</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h4>Professional Profiles</h4>
                <p>Showcase your skills with comprehensive athletic and academic profiles</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎯</div>
                <h4>Smart Matching</h4>
                <p>Our platform intelligently matches players with relevant opportunities</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default LandingPage