// portall/client/src/pages/LandingPage.jsx

import React from 'react'
import { Link } from 'react-router-dom'

/**
 * 🏠 Landing Page Portall - Première Impression Professionnelle
 * 
 * Cette page sert de vitrine pour votre plateforme, présentant clairement
 * la proposition de valeur pour chaque type d'utilisateur. Elle fonctionne
 * comme un entonnoir de conversion qui guide les visiteurs vers l'inscription.
 * 
 * 🎯 Objectifs pédagogiques de la landing page :
 * - Communiquer la valeur unique de Portall en quelques secondes
 * - Segmenter les utilisateurs selon leurs besoins (Player/Coach)
 * - Créer la confiance à travers le design et le messaging
 * - Optimiser la conversion vers l'inscription
 */
const LandingPage = () => {
  return (
    <div className="landing-page">
      {/* Header avec navigation */}
      <header className="landing-header">
        <div className="container">
          <nav className="landing-nav">
            <div className="nav-brand">
              <h1 className="brand-logo">Portall</h1>
              <span className="brand-tagline">Soccer Recruitment Platform</span>
            </div>
            
            <div className="nav-actions">
              <Link to="/login" className="nav-link">
                Sign In
              </Link>
              <Link to="/register" className="nav-button">
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Section Hero - Proposition de valeur principale */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">
                Connect NJCAA Talent with 
                <span className="highlight"> NCAA/NAIA Opportunities</span>
              </h1>
              
              <p className="hero-description">
                Portall bridges the gap between talented NJCAA soccer players and 
                NCAA/NAIA coaches, creating opportunities for the next level of competition.
              </p>
              
              <div className="hero-actions">
                <Link to="/register" className="cta-button primary">
                  Start Your Journey
                </Link>
                <button className="cta-button secondary">
                  Watch Demo
                </button>
              </div>
              
              <div className="hero-stats">
                <div className="stat-item">
                  <span className="stat-number">500+</span>
                  <span className="stat-label">Active Players</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">200+</span>
                  <span className="stat-label">Partner Coaches</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">150+</span>
                  <span className="stat-label">Successful Matches</span>
                </div>
              </div>
            </div>
            
            <div className="hero-visual">
              <div className="hero-image-placeholder">
                {/* Placeholder pour une image ou illustration */}
                <div className="soccer-illustration">⚽</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section Features - Valeur pour chaque type d'utilisateur */}
      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2>Built for Every Step of Your Soccer Journey</h2>
            <p>Whether you're a player seeking opportunities or a coach finding talent, 
               Portall provides the tools you need to succeed.</p>
          </div>
          
          <div className="features-grid">
            {/* Features pour les joueurs */}
            <div className="feature-card player-card">
              <div className="feature-icon">👤</div>
              <h3>For NJCAA Players</h3>
              <p>Showcase your skills, get evaluated by your coaches, and connect 
                 with NCAA/NAIA opportunities.</p>
              <ul className="feature-list">
                <li>Professional profile creation</li>
                <li>Coach evaluations and feedback</li>
                <li>Visibility to NCAA/NAIA recruiters</li>
                <li>Performance tracking</li>
              </ul>
              <Link to="/register" className="feature-cta">
                Create Player Profile
              </Link>
            </div>

            {/* Features pour les coachs NCAA/NAIA */}
            <div className="feature-card coach-card">
              <div className="feature-icon">🏟️</div>
              <h3>For NCAA/NAIA Coaches</h3>
              <p>Discover exceptional NJCAA talent with detailed evaluations 
                 and comprehensive player profiles.</p>
              <ul className="feature-list">
                <li>Advanced player search and filters</li>
                <li>Access to NJCAA coach evaluations</li>
                <li>Direct contact with prospects</li>
                <li>Recruitment pipeline management</li>
              </ul>
              <Link to="/register" className="feature-cta">
                Start Recruiting
              </Link>
            </div>

            {/* Features pour les coachs NJCAA */}
            <div className="feature-card njcaa-coach-card">
              <div className="feature-icon">⚽</div>
              <h3>For NJCAA Coaches</h3>
              <p>Evaluate your players professionally and help them reach 
                 the next level of competition.</p>
              <ul className="feature-list">
                <li>Player evaluation system</li>
                <li>Performance tracking tools</li>
                <li>Support player development</li>
                <li>Connect players with opportunities</li>
              </ul>
              <Link to="/register" className="feature-cta">
                Evaluate Players
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section How It Works */}
      <section className="how-it-works">
        <div className="container">
          <div className="section-header">
            <h2>How Portall Works</h2>
            <p>Simple steps to connect talent with opportunity</p>
          </div>
          
          <div className="steps-grid">
            <div className="step-item">
              <div className="step-number">1</div>
              <h3>Create Your Profile</h3>
              <p>Players showcase their skills, coaches set their preferences</p>
            </div>
            
            <div className="step-item">
              <div className="step-number">2</div>
              <h3>Get Evaluated</h3>
              <p>NJCAA coaches provide professional evaluations</p>
            </div>
            
            <div className="step-item">
              <div className="step-number">3</div>
              <h3>Connect & Recruit</h3>
              <p>NCAA/NAIA coaches discover and recruit top talent</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Final */}
      <section className="final-cta">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Take Your Soccer Journey to the Next Level?</h2>
            <p>Join hundreds of players and coaches already using Portall</p>
            <Link to="/register" className="cta-button large">
              Get Started Today
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <h3>Portall</h3>
              <p>Connecting soccer talent with opportunities</p>
            </div>
            
            <div className="footer-links">
              <div className="link-group">
                <h4>Platform</h4>
                <Link to="/login">Sign In</Link>
                <Link to="/register">Get Started</Link>
              </div>
              
              <div className="link-group">
                <h4>Support</h4>
                <a href="mailto:support@portall.com">Contact Us</a>
                <a href="/help">Help Center</a>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>&copy; 2024 Portall. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage