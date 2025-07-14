// portall/client/src/App.jsx
import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { AuthProvider, useAuth } from '@contexts/AuthContext'
import ProtectedRoute from '@components/auth/ProtectedRoute'
import PublicRoute from '@components/auth/PublicRoute'
import LoadingSpinner from '@components/common/LoadingSpinner'

// Pages d'authentification
import LoginPage from '@pages/auth/LoginPage'
import RegisterPage from '@pages/auth/RegisterPage'
import ForgotPasswordPage from '@pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@pages/auth/ResetPasswordPage'

// Pages générales
import LandingPage from '@pages/LandingPage'
import UnauthorizedPage from '@pages/UnauthorizedPage'
import NotFoundPage from '@pages/NotFoundPage'

// Dashboards (à implémenter en Phase 5B)
// import PlayerDashboard from '@pages/player/Dashboard'
// import CoachDashboard from '@pages/coach/Dashboard'
// import NJCAACoachDashboard from '@pages/njcaa-coach/Dashboard'
// import AdminDashboard from '@pages/admin/Dashboard'

/**
 * 🚀 Application Principale Portall - Phase 5A Complète
 * 
 * Cette application intègre maintenant tous les éléments de la Phase 5A :
 * - Système d'authentification complet
 * - Protection des routes selon les types d'utilisateurs
 * - Design responsive pour tous les appareils
 * - Gestion d'erreur élégante
 * - Communication fluide avec le backend
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          {/* Configuration optimisée des notifications toast */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--color-gray-800)',
                color: 'white',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-md)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
              },
              success: {
                iconTheme: {
                  primary: 'var(--color-success-500)',
                  secondary: 'white',
                },
              },
              error: {
                iconTheme: {
                  primary: 'var(--color-error-500)',
                  secondary: 'white',
                },
              },
            }}
          />

          <Routes>
            {/* 🌍 Routes publiques */}
            <Route 
              path="/" 
              element={
                <PublicRoute>
                  <LandingPage />
                </PublicRoute>
              } 
            />
            
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              } 
            />
            
            <Route 
              path="/register" 
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              } 
            />
            
            <Route 
              path="/forgot-password" 
              element={
                <PublicRoute>
                  <ForgotPasswordPage />
                </PublicRoute>
              } 
            />
            
            <Route 
              path="/reset-password/:token" 
              element={
                <PublicRoute>
                  <ResetPasswordPage />
                </PublicRoute>
              } 
            />

            {/* 🔐 Redirection intelligente vers les dashboards */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DashboardRouter />
                </ProtectedRoute>
              } 
            />

            {/* 🎯 Routes de dashboards spécifiques (Phase 5B) */}
            {/* Temporairement commentées - à implémenter en Phase 5B */}
            {/*
            <Route 
              path="/dashboard/player" 
              element={
                <ProtectedRoute allowedUserTypes={['player']}>
                  <PlayerDashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/dashboard/coach" 
              element={
                <ProtectedRoute allowedUserTypes={['coach']}>
                  <CoachDashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/dashboard/njcaa-coach" 
              element={
                <ProtectedRoute allowedUserTypes={['njcaa_coach']}>
                  <NJCAACoachDashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/dashboard/admin" 
              element={
                <ProtectedRoute allowedUserTypes={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            */}

            {/* 🚫 Pages d'erreur */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

/**
 * 🎯 Composant temporaire pour la redirection des dashboards
 * 
 * En Phase 5A, ce composant affiche un message informatif.
 * Il sera remplacé par le routeur intelligent en Phase 5B.
 */
const DashboardRouter = () => {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingSpinner message="Loading your dashboard..." />
  }

  return (
    <div className="error-page">
      <div className="error-container">
        <div className="error-illustration not-found">
          🚧
        </div>
        
        <div className="error-content">
          <h1>Dashboard Coming Soon!</h1>
          <p>
            Welcome {user?.firstName}! Your personalized {user?.userType} dashboard 
            will be available in Phase 5B. All your authentication is working perfectly.
          </p>
        </div>

        <div className="error-suggestions">
          <h3>What's working now:</h3>
          <ul className="suggestion-list">
            <li className="suggestion-item">
              ✅ User authentication and registration
            </li>
            <li className="suggestion-item">
              ✅ Secure password reset workflow
            </li>
            <li className="suggestion-item">
              ✅ Responsive design for all devices
            </li>
            <li className="suggestion-item">
              ✅ Integration with your backend API
            </li>
          </ul>
        </div>

        <div className="error-actions">
          <button 
            onClick={() => window.location.reload()} 
            className="error-button primary"
          >
            Refresh Page
          </button>
          <Link to="/" className="error-button secondary">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default App