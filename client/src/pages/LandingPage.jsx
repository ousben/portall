// portall/client/src/pages/LandingPage.jsx

import { Link } from 'react-router-dom'
import './LandingPage.css'

function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <nav className="nav-container">
          <div className="logo">
            <h1>Portall</h1>
          </div>
          <div className="nav-links">
            <Link to="/login" className="btn btn-secondary">Login</Link>
            <Link to="/signup" className="btn btn-primary">Sign Up</Link>
          </div>
        </nav>
      </header>
      
      <main>
        <section className="hero">
          <div className="hero-content">
            <h2>Connect Your Soccer Journey</h2>
            <p>The premier platform connecting NJCAA soccer players with NCAA and NAIA opportunities</p>
            <Link to="/signup" className="btn btn-primary btn-large">Get Started</Link>
          </div>
        </section>
      </main>
    </div>
  )
}

export default LandingPage