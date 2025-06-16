// portall/server/models/User.js

'use strict';

const bcrypt = require('bcryptjs');
const { bcrypt: bcryptConfig } = require('../config/auth');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
        len: [5, 255]
      },
      set(value) {
        this.setDataValue('email', value.toLowerCase().trim());
      }
    },
    
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [8, 128], // Minimum 8 caractères
        notEmpty: true,
        // Validation personnalisée pour la complexité du mot de passe
        isStrongPassword(value) {
          const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
          if (!strongPasswordRegex.test(value)) {
            throw new Error('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
          }
        }
      }
    },
    
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50],
        isAlpha: true // Uniquement des lettres
      },
      field: 'first_name',
      set(value) {
        // Capitalise la première lettre
        this.setDataValue('firstName', value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().trim());
      }
    },
    
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50],
        isAlpha: true
      },
      field: 'last_name',
      set(value) {
        this.setDataValue('lastName', value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().trim());
      }
    },
    
    userType: {
      type: DataTypes.ENUM('player', 'coach', 'admin'),
      allowNull: false,
      field: 'user_type',
      validate: {
        isIn: [['player', 'coach', 'admin']]
      }
    },
    
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
    },
    
    // Nouveau : Token de vérification email
    emailVerificationToken: {
      type: DataTypes.STRING,
      field: 'email_verification_token'
    },
    
    // Nouveau : Token de reset password
    passwordResetToken: {
      type: DataTypes.STRING,
      field: 'password_reset_token'
    },
    
    // Nouveau : Expiration du token de reset
    passwordResetExpires: {
      type: DataTypes.DATE,
      field: 'password_reset_expires'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    
    hooks: {
      // Hook pour hasher le mot de passe avant la création
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, bcryptConfig.saltRounds);
        }
        console.log(`🔐 Creating new user: ${user.email}`);
      },
      
      // Hook pour hasher le mot de passe avant la mise à jour
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, bcryptConfig.saltRounds);
          console.log(`🔐 Password updated for user: ${user.email}`);
        }
      }
    }
  });

  // **MÉTHODES D'INSTANCE IMPORTANTES**

  // Vérifier le mot de passe
  User.prototype.validatePassword = async function(password) {
    try {
      return await bcrypt.compare(password, this.password);
    } catch (error) {
      console.error('Error validating password:', error);
      return false;
    }
  };

  // Obtenir les données publiques (sans informations sensibles)
  User.prototype.toPublicJSON = function() {
    const values = Object.assign({}, this.dataValues);
    delete values.password;
    delete values.emailVerificationToken;
    delete values.passwordResetToken;
    delete values.passwordResetExpires;
    return values;
  };

  // Obtenir le nom complet
  User.prototype.getFullName = function() {
    return `${this.firstName} ${this.lastName}`;
  };

  // Marquer la dernière connexion
  User.prototype.updateLastLogin = async function() {
    this.lastLogin = new Date();
    await this.save({ fields: ['lastLogin'] });
  };

  // **MÉTHODES STATIQUES**

  // Rechercher un utilisateur par email
  User.findByEmail = async function(email) {
    return await this.findOne({
      where: { email: email.toLowerCase().trim() }
    });
  };

  // Vérifier si un email existe déjà
  User.emailExists = async function(email) {
    const user = await this.findByEmail(email);
    return !!user;
  };

  // Associations (à définir quand on créera les autres modèles)
  User.associate = function(models) {
    // Exemple futur :
    // User.hasOne(models.PlayerProfile, { foreignKey: 'userId' });
    // User.hasOne(models.CoachProfile, { foreignKey: 'userId' });
  };

  return User;
};