// server/scripts/setup-test-environment.js

const { sequelize } = require('../config/database.connection');
const models = require('../models');

/**
 * Script de configuration de l'environnement de test
 * 
 * Ce script prépare une base de données de test propre avec :
 * - Tables synchronisées selon vos modèles
 * - Données de référence essentielles pour les tests
 * - Configuration optimisée pour l'exécution rapide
 */

async function setupTestEnvironment() {
  try {
    console.log('🧪 Configuration de l\'environnement de test...');
    console.log('===============================================');
    
    // Forcer l'utilisation de l'environnement de test
    process.env.NODE_ENV = 'test';
    
    // Tester la connexion à la base de données de test
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données de test réussie');
    
    // Synchroniser les modèles avec la base de données de test
    console.log('📊 Synchronisation des modèles...');
    await sequelize.sync({ force: true }); // force: true recrée les tables à chaque fois
    console.log('✅ Modèles synchronisés avec succès');
    
    // Créer les données de référence minimales pour les tests
    console.log('📋 Création des données de référence pour les tests...');
    
    // Créer quelques colleges NJCAA pour les tests de joueurs
    const njcaaColleges = await models.NJCAACollege.bulkCreate([
      {
        name: 'Test NJCAA College 1',
        state: 'CA',
        region: 'West',
        division: 'division_1',
        website: 'https://test-njcaa-1.edu',
        isActive: true
      },
      {
        name: 'Test NJCAA College 2', 
        state: 'TX',
        region: 'South',
        division: 'division_2',
        website: 'https://test-njcaa-2.edu',
        isActive: true
      }
    ]);
    
    // Créer quelques colleges NCAA pour les tests de coachs
    const ncaaColleges = await models.NCAACollege.bulkCreate([
      {
        name: 'Test NCAA College 1',
        state: 'FL',
        division: 'ncaa_d1',
        conference: 'Test Conference',
        website: 'https://test-ncaa-1.edu',
        isActive: true
      },
      {
        name: 'Test NCAA College 2',
        state: 'NY', 
        division: 'ncaa_d2',
        conference: 'Test Conference',
        website: 'https://test-ncaa-2.edu',
        isActive: true
      }
    ]);
    
    console.log(`✅ ${njcaaColleges.length} colleges NJCAA créés pour les tests`);
    console.log(`✅ ${ncaaColleges.length} colleges NCAA créés pour les tests`);
    
    // Afficher un résumé de l'environnement configuré
    console.log('\n🎉 Environnement de test configuré avec succès !');
    console.log('================================================');
    console.log(`📊 Base de données: ${sequelize.config.database}`);
    console.log(`🏫 Colleges NJCAA disponibles: ${njcaaColleges.length}`);
    console.log(`🏫 Colleges NCAA disponibles: ${ncaaColleges.length}`);
    console.log('🚀 Prêt pour l\'exécution des tests !');
    
    return {
      njcaaColleges,
      ncaaColleges
    };
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration de l\'environnement de test:', error);
    throw error;
  }
}

// Exporter la fonction pour utilisation par d'autres scripts
module.exports = setupTestEnvironment;

// Exécuter le script si appelé directement
if (require.main === module) {
  setupTestEnvironment()
    .then(() => {
      console.log('\n🏁 Configuration terminée avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Échec de la configuration:', error.message);
      process.exit(1);
    });
}