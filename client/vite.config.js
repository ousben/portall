// portall/client/vite.config.js

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Cette configuration nous permet d'utiliser des imports absolus
// Au lieu de: import Component from '../../../components/Component'
// On pourra faire: import Component from '@/components/Component'
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@assets': path.resolve(__dirname, './src/assets'),
    }
  },
  // Configuration du serveur de développement
  server: {
    port: 3000,
    proxy: {
      // Ceci redirigera toutes les requêtes /api vers notre backend
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    },
    // CORRECTION : Configuration pour éviter les erreurs de source map
    build: {
      sourcemap: false, // Désactive les source maps en production pour éviter les erreurs
    },
    css: {
      devSourcemap: true, // Active les source maps CSS seulement en développement
    }
  }
})