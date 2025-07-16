// portall/client/vite.config.js

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Configuration Vite optimisée pour Portall - Version Corrigée
export default defineConfig({
  plugins: [react()],
  
  // Configuration du serveur de développement
  server: {
    port: 3000,
    // ✅ CORRECTION : Proxy vers le bon port backend
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // ← Corrigé pour pointer vers 5000
        changeOrigin: true,
        secure: false,
        // Ajout de logging pour débogage
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('🚨 Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('🔄 Proxying request:', req.method, req.url, '→', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('✅ Proxy response:', proxyRes.statusCode, req.url);
          });
        }
      }
    }
  },
  
  // ✅ Alias de chemins pour simplifier les imports
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
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '5.0.0'),
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