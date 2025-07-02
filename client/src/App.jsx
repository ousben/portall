// portall/client/src/App.jsx

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'

// Import des pages existantes
import LandingPage from '@pages/LandingPage'
import LoginPage from '@pages/LoginPage'
import SignupPage from '@pages/SignupPage'
import NotFoundPage from '@pages/NotFoundPage'

// NOUVEAUX : Import des pages dashboard
import PlayerDashboard from '@pages/PlayerDashboard'
import CoachDashboard from '@pages/CoachDashboard'

// Import du Context d'authentification
import { AuthProvider } from '@contexts/AuthContext'

// NOUVEAU : Import du composant de protection des routes
import ProtectedRoute from '@components/ProtectedRoute'
import DashboardRouter from '@components/DashboardRouter'

// Import des styles globaux
import '@assets/styles/reset.css'
import '@assets/styles/variables.css'
import '@assets/styles/global.css'

/**
 * Composant principal de l'application avec routage étendu
 * 
 * Cette version étendue de votre App.jsx intègre le système de dashboards
 * tout en conservant votre architecture existante. J'ai ajouté deux concepts
 * importants pour la gestion des routes protégées :
 * 
 * 1. ProtectedRoute : Composant qui vérifie l'authentification et les permissions
 * 2. DashboardRouter : Routeur intelligent qui redirige vers le bon dashboard
 * 
 * Architecture pédagogique : Cette approche montre comment étendre une
 * application existante en ajoutant de nouvelles fonctionnalités sans
 * casser l'existant - principe de l'Open/Closed Principle en SOLID.
 */
function App() {
  // Même effet de debugging que dans votre version originale
  useEffect(() => {
    console.log('🚀 Portall App v0.3.0 - Dashboard Routes Complete')
  }, [])

  return (
    <AuthProvider>
      <Router>
        {/* Configuration des notifications toast - inchangée */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        
        <Routes>
          {/* Routes publiques existantes - inchangées */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* NOUVELLES ROUTES PROTÉGÉES POUR LES DASHBOARDS */}
          
          {/* Route intelligente qui redirige vers le bon dashboard selon le type d'utilisateur */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            } 
          />
          
          {/* Routes spécifiques pour chaque type de dashboard */}
          <Route 
            path="/dashboard/player" 
            element={
              <ProtectedRoute requiredUserType="player">
                <PlayerDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/dashboard/coach" 
            element={
              <ProtectedRoute requiredUserType="coach">
                <CoachDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Routes futures pour les fonctionnalités avancées */}
          <Route 
            path="/profile/edit" 
            element={
              <ProtectedRoute>
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <h2>Profile Edit Page</h2>
                  <p>Coming soon! Edit your profile here.</p>
                </div>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/analytics" 
            element={
              <ProtectedRoute>
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <h2>Analytics Page</h2>
                  <p>Coming soon! Detailed analytics and insights.</p>
                </div>
              </ProtectedRoute>
            } 
          />
          
          {/* Route 404 - toujours en dernier */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App