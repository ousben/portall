// portall/server/config/database.connection.js

const { Sequelize } = require('sequelize');
const config = require('./database.js');

// Détermine l'environnement (development par défaut)
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Créer l'instance Sequelize
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    define: dbConfig.define,
    dialectOptions: dbConfig.dialectOptions || {}
  }
);

// Fonction pour tester la connexion
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    process.exit(1); // Arrête l'application si la connexion échoue
  }
};

module.exports = { sequelize, testConnection };