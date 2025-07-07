// server/tests/setup.js

// Charger les variables d'environnement de test AVANT tout autre import
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only'; // ← CRUCIAL
require('dotenv').config({ path: '.env.test' });

const { sequelize } = require('../config/database.connection');

/**
 * 🔧 Configuration des tests avec JWT unifié
 * 
 * CORRECTION : Configuration explicite du JWT_SECRET pour les tests
 * pour garantir la cohérence entre génération et vérification des tokens.
 */

// Configuration globale avant tous les tests
beforeAll(async () => {
  // Vérifier que nous sommes bien en environnement de test
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Les tests doivent s\'exécuter en environnement TEST uniquement');
  }

  console.log('🔧 Setting up test environment...');
  console.log(`🔑 JWT Secret configured: ${process.env.JWT_SECRET ? 'YES' : 'NO'}`);
  
  // Vérifier la connexion à la base de données
  try {
    await sequelize.authenticate();
    console.log('✅ Test database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to test database:', error);
    throw error;
  }

  // Synchroniser les modèles avec la base de données de test
  try {
    await sequelize.sync({ force: true });
    console.log('✅ Test database synchronized successfully.');
  } catch (error) {
    console.error('❌ Unable to sync test database:', error);
    throw error;
  }

  // Supprimer les logs console pendant les tests pour plus de clarté
  if (process.env.DISABLE_LOGGING === 'true') {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    
    // Garder une référence pour les diagnostics si nécessaire
    global.originalConsole = {
      log: originalLog,
      error: originalError,
      warn: originalWarn
    };
  }
});

// Nettoyage après chaque test individuel
afterEach(async () => {
  // Nettoyer les mocks Jest pour éviter les interférences entre tests
  jest.clearAllMocks();
});

// Nettoyage final après tous les tests
afterAll(async () => {
  // Fermer proprement la connexion à la base de données
  try {
    await sequelize.close();
    console.log('✅ Test database connection closed.');
  } catch (error) {
    console.error('❌ Error closing test database connection:', error);
  }
});

// Configuration des timeouts globaux pour les tests de base de données
jest.setTimeout(30000);

// Gérer les rejections non gérées pendant les tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});