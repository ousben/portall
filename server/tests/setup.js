// portall/server/tests/setup.js

// Charger les variables d'environnement de test AVANT tout autre import
process.env.NODE_ENV = 'test';
require('dotenv').config({ path: '.env.test' });

const { sequelize } = require('../config/database.connection');

/**
 * 🔧 Configuration globale des tests avec gestion complète de l'environnement
 * 
 * Ce fichier configure l'environnement de test pour garantir que chaque test
 * s'exécute dans un environnement propre et prévisible. Pensez à cela comme
 * préparer un laboratoire scientifique avant chaque expérience.
 * 
 * 🎯 Fonctionnalités :
 * - Connexion et synchronisation de la base de données de test
 * - Nettoyage entre les tests pour éviter les interférences
 * - Gestion des timeouts pour les opérations de base de données
 * - Configuration des logs pour plus de clarté pendant les tests
 */

// Configuration globale avant tous les tests
beforeAll(async () => {
  // Vérifier que nous sommes bien en environnement de test
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Les tests doivent s\'exécuter en environnement TEST uniquement');
  }

  console.log('🔧 Setting up test environment...');
  
  // Vérifier la connexion à la base de données
  try {
    await sequelize.authenticate();
    console.log('✅ Test database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to test database:', error);
    throw error;
  }

  // Synchroniser les modèles avec la base de données de test
  // ATTENTION : force: true efface toutes les données existantes
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
// Les opérations de base de données peuvent prendre du temps, surtout lors des synchronisations
jest.setTimeout(30000);

// Gérer les rejections non gérées pendant les tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});