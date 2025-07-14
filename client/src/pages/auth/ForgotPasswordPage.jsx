// portall/client/src/pages/auth/ForgotPasswordPage.jsx
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthService from '@services/authService'
import toast from 'react-hot-toast'

/**
 * 🔑 Page de récupération de mot de passe
 * 
 * Cette page utilise votre endpoint POST /api/auth/forgot-password pour
 * envoyer un email de récupération via votre système d'email intégré.
 */
const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!email.trim()) {
      toast.error('Please enter your email address')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await AuthService.forgotPassword(email)

      if (result.success) {
        setIsSubmitted(true)
        toast.success('Password reset email sent! Check your inbox.')
      } else {
        toast.error(result.message || 'Failed to send reset email')
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <h1>Check Your Email</h1>
              <p>We've sent a password reset link to <strong>{email}</strong></p>
            </div>

            <div className="success-message">
              <p>Please check your email inbox and click the reset link to create a new password.</p>
              <p>Don't see the email? Check your spam folder or try again.</p>
            </div>

            <div className="auth-links">
              <Link to="/login" className="auth-button">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Reset Your Password</h1>
            <p>Enter your email address and we'll send you a link to reset your password</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="Enter your email"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              className={`auth-button ${isSubmitting ? 'loading' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="auth-links">
            <Link to="/login" className="link">
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage