// portall/server/models/index.js

'use strict';

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database.connection'); // ← Utilise votre config unifiée
const basename = path.basename(__filename);
const db = {};

// Charger automatiquement tous les modèles du dossier models
fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    // Charger chaque modèle en utilisant notre instance sequelize
    const model = require(path.join(__dirname, file));
    
    // Vérifier si le modèle exporte une fonction ou un objet
    if (typeof model === 'function') {
      // Si c'est une fonction, l'appeler avec sequelize et DataTypes
      const modelInstance = model(sequelize, sequelize.Sequelize.DataTypes);
      db[modelInstance.name] = modelInstance;
    } else {
      // Si c'est déjà un modèle configuré, l'utiliser directement
      db[model.name] = model;
    }
  });

// Configurer les associations entre modèles
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Exporter l'instance sequelize et les modèles
db.sequelize = sequelize;
db.Sequelize = sequelize.Sequelize;

module.exports = db;