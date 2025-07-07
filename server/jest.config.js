// portall/server/jest.config.js

module.exports = {
  // Environnement d'exécution - Node.js pour les tests backend
  testEnvironment: 'node',
  
  // Patterns des fichiers de test à exécuter
  testMatch: [
    '**/tests/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Dossiers à ignorer lors de la recherche de tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/dist/'
  ],
  
  // Configuration de la couverture de code
  collectCoverageFrom: [
    'controllers/**/*.js',
    'models/**/*.js',
    'middleware/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  
  // Format de sortie des résultats de test
  verbose: true,
  
  // Temps maximum d'attente pour chaque test (30 secondes)
  testTimeout: 30000,
  
  // Configuration pour les tests de base de données
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Configuration pour éviter les warnings sur les variables d'environnement
  globals: {
    'process.env': {
      NODE_ENV: 'test'
    }
  }
};