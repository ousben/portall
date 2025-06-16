// portall/client/src/App.jsx

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'

// Import des pages (nous les créerons juste après)
import LandingPage from '@pages/LandingPage'
import LoginPage from '@pages/LoginPage'
import SignupPage from '@pages/SignupPage'
import NotFoundPage from '@pages/NotFoundPage'

// Import des styles globaux
import '@assets/styles/reset.css'
import '@assets/styles/variables.css'
import '@assets/styles/global.css'

function App() {
  // Ceci est un petit trick pour afficher la version de l'app dans la console
  // Utile pendant le développement
  useEffect(() => {
    console.log('🚀 Portall App v0.1.0 - Development Mode')
  }, [])

  return (
    <Router>
      <Routes>
        {/* Routes publiques */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        
        {/* Route 404 - toujours en dernier */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  )
}

export default App
