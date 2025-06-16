// portall/server/scripts/setup-database.js
const { sequelize } = require('../config/database.connection');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const setupDatabase = async () => {
  try {
    console.log('🔧 Setting up database...\n');
    
    // Tester la connexion
    await sequelize.authenticate();
    console.log('✅ Database connection successful\n');
    
    // Demander confirmation avant de synchroniser
    rl.question('Do you want to sync all models? This will create/update tables. (yes/no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        console.log('\n📊 Synchronizing models...');
        await sequelize.sync({ alter: true });
        console.log('✅ Database synchronized successfully!\n');
        
        // Créer un utilisateur admin par défaut
        const User = require('../models/User');
        const adminExists = await User.findOne({ where: { email: 'admin@portall.com' } });
        
        if (!adminExists) {
          rl.question('Create default admin user? (yes/no): ', async (createAdmin) => {
            if (createAdmin.toLowerCase() === 'yes') {
              // Note: En Phase 2, nous hasherons le mot de passe
              await User.create({
                email: 'admin@portall.com',
                password: 'admin123', // À hasher en Phase 2!
                firstName: 'Admin',
                lastName: 'Portall',
                userType: 'admin',
                isActive: true,
                isEmailVerified: true
              });
              console.log('✅ Admin user created (admin@portall.com / admin123)');
              console.log('⚠️  Remember to change the password!\n');
            }
            rl.close();
            process.exit(0);
          });
        } else {
          console.log('ℹ️  Admin user already exists\n');
          rl.close();
          process.exit(0);
        }
      } else {
        console.log('❌ Database sync cancelled');
        rl.close();
        process.exit(0);
      }
    });
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    rl.close();
    process.exit(1);
  }
};

setupDatabase();