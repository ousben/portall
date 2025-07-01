// portall/server/scripts/run-migrations.js

const { exec } = require('child_process');
const path = require('path');

/**
 * Script utilitaire pour exécuter toutes les migrations de la Phase 3
 * 
 * Ce script automatise l'exécution séquentielle de toutes les migrations
 * dans le bon ordre, avec gestion des erreurs et feedback détaillé.
 */

console.log('🚀 Starting Phase 3 migrations...');
console.log('=====================================');

const migrations = [
  'npx sequelize db:migrate --migrations-path migrations --to 20250701120000-create-reference-colleges.js',
  'npx sequelize db:migrate --migrations-path migrations --to 20250701130000-create-player-profiles.js', 
  'npx sequelize db:migrate --migrations-path migrations --to 20250701140000-create-coach-profiles.js',
  'npx sequelize db:migrate --migrations-path migrations --to 20250701150000-create-coach-favorites.js',
  'npx sequelize db:migrate --migrations-path migrations --to 20250701160000-seed-demo-data.js'
];

async function runMigrations() {
  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    console.log(`\n📋 Step ${i + 1}/${migrations.length}: Running migration...`);
    
    try {
      await runCommand(migration);
      console.log(`✅ Step ${i + 1} completed successfully`);
    } catch (error) {
      console.error(`❌ Step ${i + 1} failed:`, error);
      process.exit(1);
    }
  }
  
  console.log('\n🎉 All Phase 3 migrations completed successfully!');
  console.log('\n📊 Your database now includes:');
  console.log('   ✅ Reference tables for NJCAA and NCAA colleges');
  console.log('   ✅ Player profiles with extended information');
  console.log('   ✅ Coach profiles with professional details');
  console.log('   ✅ Favorites system for coach-player relationships');
  console.log('   ✅ Demo data for immediate testing');
  console.log('\n🔗 Next steps:');
  console.log('   1. Test the new API endpoints');
  console.log('   2. Update frontend forms');
  console.log('   3. Implement dashboard features');
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      if (stderr) {
        console.log('⚠️  Warnings:', stderr);
      }
      
      if (stdout) {
        console.log(stdout);
      }
      
      resolve();
    });
  });
}

// Exécuter le script
runMigrations().catch(console.error);