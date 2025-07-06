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
        len: [8, 128],
        notEmpty: true,
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
        isAlpha: true
      },
      field: 'first_name',
      set(value) {
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
      type: DataTypes.ENUM('player', 'coach', 'admin', 'njcaa_coach'),
      allowNull: false,
      field: 'user_type',
      validate: {
        isIn: [['player', 'coach', 'admin', 'njcaa_coach']]
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
    
    emailVerificationToken: {
      type: DataTypes.STRING,
      field: 'email_verification_token'
    },
    
    passwordResetToken: {
      type: DataTypes.STRING,
      field: 'password_reset_token'
    },
    
    passwordResetExpires: {
      type: DataTypes.DATE,
      field: 'password_reset_expires'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, bcryptConfig.saltRounds);
        }
        console.log(`🔐 Creating new user: ${user.email}`);
      },
      
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, bcryptConfig.saltRounds);
          console.log(`🔐 Password updated for user: ${user.email}`);
        }
      }
    }
  });

  // Méthodes d'instance existantes
  User.prototype.validatePassword = async function(password) {
    try {
      return await bcrypt.compare(password, this.password);
    } catch (error) {
      console.error('Error validating password:', error);
      return false;
    }
  };

  User.prototype.toPublicJSON = function() {
    const values = Object.assign({}, this.dataValues);
    delete values.password;
    delete values.emailVerificationToken;
    delete values.passwordResetToken;
    delete values.passwordResetExpires;
    return values;
  };

  User.prototype.getFullName = function() {
    return `${this.firstName} ${this.lastName}`;
  };

  User.prototype.updateLastLogin = async function() {
    this.lastLogin = new Date();
    await this.save({ fields: ['lastLogin'] });
  };

  // NOUVELLES méthodes pour gérer les profils
  User.prototype.getProfile = async function() {
    if (this.userType === 'player') {
      return await this.getPlayerProfile({
        include: ['college']
      });
    } else if (this.userType === 'coach') {
      return await this.getCoachProfile({
        include: ['college']
      });
    } else if (this.userType === 'njcaa_coach') {
      // NOUVEAU: Support pour les coachs NJCAA
      return await this.getNjcaaCoachProfile({
        include: ['college']
      });
    }
    return null;
  };

  User.prototype.toCompleteJSON = async function() {
    const userJSON = this.toPublicJSON();
    const profile = await this.getProfile();
    
    return {
      ...userJSON,
      profile: profile ? profile.toJSON() : null
    };
  };

  // Méthodes statiques existantes
  User.findByEmail = async function(email) {
    return await this.findOne({
      where: { email: email.toLowerCase().trim() }
    });
  };

  User.emailExists = async function(email) {
    const user = await this.findByEmail(email);
    return !!user;
  };

  // NOUVELLES associations avec les profils
  User.associate = function(models) {
    // Un utilisateur peut avoir un profil joueur
    User.hasOne(models.PlayerProfile, {
      foreignKey: 'userId',
      as: 'playerProfile',
      constraints: false // Permet la relation optionnelle
    });
    
    // Un utilisateur peut avoir un profil coach NCAA/NAIA
    User.hasOne(models.CoachProfile, {
      foreignKey: 'userId',
      as: 'coachProfile',
      constraints: false
    });
    
    // NOUVEAU: Un utilisateur peut avoir un profil coach NJCAA
    User.hasOne(models.NJCAACoachProfile, {
      foreignKey: 'userId',
      as: 'njcaaCoachProfile',
      constraints: false
    });
  };

  return User;
};