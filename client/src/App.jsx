// portall/client/src/App.jsx

import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { AuthProvider } from '@contexts/AuthContext'
import ProtectedRoute from '@components/auth/ProtectedRoute'
import PublicRoute from '@components/auth/PublicRoute'
import LoadingSpinner from '@components/common/LoadingSpinner'

// Pages d'authentification (Phase 5A - déjà implémentées)
import LoginPage from '@pages/auth/LoginPage'
import RegisterPage from '@pages/auth/RegisterPage'
import ForgotPasswordPage from '@pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@pages/auth/ResetPasswordPage'

// Pages générales (Phase 5A - déjà implémentées)
import LandingPage from '@pages/LandingPage'
import UnauthorizedPage from '@pages/UnauthorizedPage'
import NotFoundPage from '@pages/NotFoundPage'

// 🎯 NOUVEAUX DASHBOARDS PHASE 5B
import PlayerDashboard from '@pages/dashboard/PlayerDashboard'
import CoachDashboard from '@pages/dashboard/CoachDashboard'
import NJCAACoachDashboard from '@pages/dashboard/NJCAACoachDashboard'
import AdminDashboard from '@pages/dashboard/AdminDashboard'

// 👤 NOUVELLES PAGES DE PROFIL PHASE 5B
import ProfileEdit from '@pages/profile/ProfileEdit'
import ProfileView from '@pages/profile/ProfileView'

// 🧭 Composant de routage intelligent
import DashboardRouter from '@components/dashboard/DashboardRouter'

/**
 * 🚀 Application Principale Portall - Phase 5B Complète
 * 
 * Cette version finalise l'architecture frontend en connectant tous les
 * dashboards spécialisés avec l'API backend. Chaque type d'utilisateur
 * dispose maintenant de son interface optimisée.
 * 
 * 🎯 Nouveautés Phase 5B :
 * - Dashboards fonctionnels pour tous les types d'utilisateurs
 * - Gestion de profil complète
 * - Routage intelligent automatique
 * - Intégration fluide avec le workflow unifié des coachs
 * 
 * 🏗️ Architecture en couches :
 * 1. Routes publiques (pour visiteurs non connectés)
 * 2. Routes d'authentification (login, register, etc.)
 * 3. Routes protégées (dashboards, profils)
 * 4. Routes de gestion d'erreur
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          {/* 🎨 Configuration des notifications utilisateur */}
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
            {/* 🌍 ROUTES PUBLIQUES */}
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

            {/* 🧭 ROUTE DE DASHBOARD INTELLIGENT */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DashboardRouter />
                </ProtectedRoute>
              } 
            />

            {/* 🎯 DASHBOARDS SPÉCIALISÉS PHASE 5B */}
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

            {/* 👤 ROUTES DE GESTION DE PROFIL */}
            <Route 
              path="/profile/edit" 
              element={
                <ProtectedRoute>
                  <ProfileEdit />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/profile/view/:userId?" 
              element={
                <ProtectedRoute>
                  <ProfileView />
                </ProtectedRoute>
              } 
            />

            {/* 🚫 ROUTES D'ERREUR */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App