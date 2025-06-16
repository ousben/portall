// portall/client/src/pages/LoginPage.jsx

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './LoginPage.css'

function LoginPage() {
  // useState est un Hook React qui nous permet de gérer l'état local
  // Ici, on stocke les valeurs du formulaire
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  
  // useNavigate nous permet de rediriger l'utilisateur programmatiquement
  const navigate = useNavigate()

  // Cette fonction met à jour l'état quand l'utilisateur tape dans un champ
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Gestion de la soumission du formulaire
  const handleSubmit = (e) => {
    e.preventDefault() // Empêche le rechargement de la page
    
    // Pour l'instant, on affiche juste les données dans la console
    // Plus tard, on enverra ces données à notre API
    console.log('Login attempt:', formData)
    
    // TODO: Implémenter la vraie logique de connexion en Phase 2
    alert('Login functionality will be implemented in Phase 2!')
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Welcome Back</h1>
          <p>Log in to access your Portall account</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
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
              placeholder="Enter your password"
            />
          </div>
          
          <button type="submit" className="btn btn-primary btn-full">
            Log In
          </button>
        </form>
        
        <div className="login-footer">
          <p>Don't have an account? <Link to="/signup">Sign up</Link></p>
          <Link to="/" className="back-link">← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}

export default LoginPage