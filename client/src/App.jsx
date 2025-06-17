// portall/client/src/App.jsx

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast' // Import des notifications

// Import des pages (nous les créerons juste après)
import LandingPage from '@pages/LandingPage'
import LoginPage from '@pages/LoginPage'
import SignupPage from '@pages/SignupPage'
import NotFoundPage from '@pages/NotFoundPage'

// Import du Context d'authentification
import { AuthProvider } from '@contexts/AuthContext'

// Import des styles globaux
import '@assets/styles/reset.css'
import '@assets/styles/variables.css'
import '@assets/styles/global.css'

function App() {
  // Ceci est un petit trick pour afficher la version de l'app dans la console
  // Utile pendant le développement
  useEffect(() => {
    console.log('🚀 Portall App v0.2.0 - Authentication Ready')
  }, [])

  return (
    // Envelopper toute l'application dans le AuthProvider
    // Cela rend le context d'authentification disponible partout
    <AuthProvider>
      <Router>
        {/* Configuration des notifications toast */}
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
          {/* Routes publiques */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* Route 404 - toujours en dernier */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
