// server/models/User.js

'use strict';

const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        len: [1, 255]
      },
      set(value) {
        // Normaliser l'email en minuscules
        this.setDataValue('email', value.toLowerCase().trim());
      }
    },
    
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [8, 255]
      }
    },
    
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 50]
      },
      field: 'first_name'
    },
    
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 50]
      },
      field: 'last_name'
    },
    
    userType: {
      type: DataTypes.ENUM('player', 'coach', 'admin', 'njcaa_coach'),
      allowNull: false,
      field: 'user_type'
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
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    
    hooks: {
      beforeCreate: async (user, options) => {
        // Hasher le mot de passe si fourni en texte clair
        if (user.password && !user.password.startsWith('$2')) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
      
      beforeUpdate: async (user, options) => {
        // Re-hasher le mot de passe seulement s'il a changé
        if (user.changed('password') && user.password && !user.password.startsWith('$2')) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      }
    }
  });

  // Méthodes d'instance pour authentification
  User.prototype.validatePassword = async function(plainPassword) {
    try {
      return await bcrypt.compare(plainPassword, this.password);
    } catch (error) {
      console.error('Password validation error:', error);
      return false;
    }
  };

  User.prototype.toPublicJSON = function() {
    const values = Object.assign({}, this.dataValues);
    // Supprimer les champs sensibles
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

  // ✅ CORRECTION CRITIQUE : Méthode getProfile simplifiée et robuste
  User.prototype.getProfile = async function() {
    try {
      // Utiliser les associations Sequelize déjà chargées si disponibles
      if (this.userType === 'player' && this.playerProfile) {
        return this.playerProfile;
      } else if (this.userType === 'coach' && this.coachProfile) {
        return this.coachProfile;
      } else if (this.userType === 'njcaa_coach' && this.njcaaCoachProfile) {
        return this.njcaaCoachProfile;
      }
      
      // Si les associations ne sont pas chargées, les récupérer manuellement
      const models = sequelize.models;
      
      if (this.userType === 'player') {
        return await models.PlayerProfile.findOne({
          where: { userId: this.id },
          include: [{ model: models.NJCAACollege, as: 'college' }]
        });
      } else if (this.userType === 'coach') {
        return await models.CoachProfile.findOne({
          where: { userId: this.id },
          include: [{ model: models.NCAACollege, as: 'college' }]
        });
      } else if (this.userType === 'njcaa_coach') {
        return await models.NJCAACoachProfile.findOne({
          where: { userId: this.id },
          include: [{ model: models.NJCAACollege, as: 'college' }]
        });
      }
      
      return null;
    } catch (error) {
      console.error('Error in getProfile:', error);
      return null;
    }
  };

  User.prototype.toCompleteJSON = async function() {
    const userJSON = this.toPublicJSON();
    const profile = await this.getProfile();
    
    return {
      ...userJSON,
      profile: profile ? profile.toJSON() : null
    };
  };

  // Méthodes statiques
  User.findByEmail = async function(email) {
    return await this.findOne({
      where: { email: email.toLowerCase().trim() }
    });
  };

  User.emailExists = async function(email) {
    const user = await this.findByEmail(email);
    return !!user;
  };

  // ✅ ASSOCIATIONS COMPLÈTES ET CORRECTES
  User.associate = function(models) {
    // Un utilisateur peut avoir un profil joueur
    User.hasOne(models.PlayerProfile, {
      foreignKey: 'userId',
      as: 'playerProfile',
      onDelete: 'CASCADE'
    });
    
    // Un utilisateur peut avoir un profil coach NCAA/NAIA
    User.hasOne(models.CoachProfile, {
      foreignKey: 'userId',
      as: 'coachProfile',
      onDelete: 'CASCADE'
    });
    
    // ✅ CRUCIAL : Un utilisateur peut avoir un profil coach NJCAA
    User.hasOne(models.NJCAACoachProfile, {
      foreignKey: 'userId',
      as: 'njcaaCoachProfile',
      onDelete: 'CASCADE'
    });
  };

  return User;
};