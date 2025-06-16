// portall/server/config/auth.js

require('dotenv').config();

module.exports = {
  jwt: {
    // En production, utilisez une clé plus complexe et stockée de manière sécurisée
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
  },
  
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5 // 5 tentatives par IP
  },
  
  // Configuration pour différents environnements
  security: {
    development: {
      strictValidation: false,
      detailedErrors: true
    },
    production: {
      strictValidation: true,
      detailedErrors: false
    }
  }
};