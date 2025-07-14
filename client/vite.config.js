// portall/client/vite.config.js

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Configuration Vite optimisée pour Portall
export default defineConfig({
  plugins: [react()],
  
  // Configuration du serveur de développement
  server: {
    port: 3000,
    // Proxy automatique vers votre API backend
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  
  // Alias de chemins pour simplifier les imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@styles': path.resolve(__dirname, './src/styles')
    }
  },
  
  // Variables d'environnement disponibles côté client
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  
  // Optimisation du build de production
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimisation pour les chunks
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          api: ['axios']
        }
      }
    }
  }
})