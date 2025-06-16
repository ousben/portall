// portall/server/models/User.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database.connection');

// Définition du modèle User
const User = sequelize.define('User', {
  // Sequelize ajoute automatiquement un champ 'id' comme clé primaire
  
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true, // Validation automatique du format email
      notEmpty: true
    },
    // Convertit l'email en minuscules avant de sauvegarder
    set(value) {
      this.setDataValue('email', value.toLowerCase());
    }
  },
  
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [6, 100], // Longueur entre 6 et 100 caractères
      notEmpty: true
    }
  },
  
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 50]
    },
    field: 'first_name' // Nom de la colonne dans la DB
  },
  
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 50]
    },
    field: 'last_name'
  },
  
  userType: {
    type: DataTypes.ENUM('player', 'coach', 'admin'),
    allowNull: false,
    field: 'user_type'
  },
  
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // Compte inactif jusqu'à validation admin
    field: 'is_active'
  },
  
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_email_verified'
  },
  
  lastLogin: {
    type: DataTypes.DATE,
    field: 'last_login'
  }
}, {
  // Options du modèle
  tableName: 'users',
  timestamps: true, // Ajoute created_at et updated_at
  underscored: true, // Utilise snake_case pour les colonnes
  
  // Hooks - fonctions qui s'exécutent à certains moments
  hooks: {
    // Avant de créer un utilisateur
    beforeCreate: (user) => {
      console.log(`Creating new user: ${user.email}`);
    }
  },
  
  // Méthodes d'instance (disponibles sur chaque objet user)
  instanceMethods: {
    getFullName() {
      return `${this.firstName} ${this.lastName}`;
    }
  }
});

// Méthodes personnalisées
User.prototype.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Méthode pour obtenir les données publiques (sans le mot de passe)
User.prototype.toPublicJSON = function() {
  const values = Object.assign({}, this.dataValues);
  delete values.password;
  return values;
};

module.exports = User;