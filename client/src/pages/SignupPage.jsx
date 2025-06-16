// portall/client/src/pages/SignupPage.jsx

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './SignupPage.css'

function SignupPage() {
  const [formData, setFormData] = useState({
    userType: '', // 'player' or 'coach'
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Validation basique
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match!')
      return
    }
    
    console.log('Signup attempt:', formData)
    alert('Signup functionality will be implemented in Phase 2!')
  }

  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="signup-header">
          <h1>Join Portall</h1>
          <p>Create your account to start your journey</p>
        </div>
        
        <form onSubmit={handleSubmit} className="signup-form">
          {/* Sélection du type d'utilisateur */}
          <div className="form-group">
            <label>I am a:</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="userType"
                  value="player"
                  checked={formData.userType === 'player'}
                  onChange={handleChange}
                  required
                />
                <span>NJCAA Player</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="userType"
                  value="coach"
                  checked={formData.userType === 'coach'}
                  onChange={handleChange}
                  required
                />
                <span>NCAA/NAIA Coach</span>
              </label>
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="8"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>
          
          <button type="submit" className="btn btn-primary btn-full">
            Create Account
          </button>
        </form>
        
        <div className="signup-footer">
          <p>Already have an account? <Link to="/login">Log in</Link></p>
          <Link to="/" className="back-link">← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}

export default SignupPage