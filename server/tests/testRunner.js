// server/tests/testRunner.js

const { exec } = require('child_process');
const path = require('path');

/**
 * 🏃‍♂️ Script de lancement des tests avec configuration optimisée
 * 
 * Ce script configure l'environnement de test et lance les tests
 * dans le bon ordre avec un reporting détaillé.
 */

async function runNJCAACoachTests() {
  console.log('🧪 Starting NJCAA Coach Implementation Tests...\n');

  // Configuration des variables d'environnement pour les tests
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://localhost:5432/portall_test';
  process.env.JWT_SECRET = 'test_jwt_secret_key';

  const testCommands = [
    {
      name: '🏗️ Unit Tests - Models',
      command: 'npx jest tests/unit/models/njcaaCoachProfile.test.js --verbose'
    },
    {
      name: '🔧 Integration Tests - API Routes',
      command: 'npx jest tests/integration/api/njcaaCoachRoutes.test.js --verbose'
    },
    {
      name: '🎭 End-to-End Tests - Complete Workflow',
      command: 'npx jest tests/e2e/njcaaCoachWorkflow.test.js --verbose'
    }
  ];

  let allTestsPassed = true;

  for (const test of testCommands) {
    console.log(`\n${test.name}`);
    console.log('='.repeat(50));

    try {
      await runCommand(test.command);
      console.log(`✅ ${test.name} - PASSED`);
    } catch (error) {
      console.log(`❌ ${test.name} - FAILED`);
      console.error(error);
      allTestsPassed = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('🎉 ALL NJCAA COACH TESTS PASSED!');
    console.log('✅ Your implementation is production-ready!');
  } else {
    console.log('⚠️ Some tests failed. Please review and fix issues.');
    process.exit(1);
  }
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        console.log(stdout);
        if (stderr) console.error(stderr);
        resolve();
      }
    });
  });
}

// Lancer les tests si ce script est exécuté directement
if (require.main === module) {
  runNJCAACoachTests().catch(console.error);
}

module.exports = { runNJCAACoachTests };