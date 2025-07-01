// portall/server/models/PlayerProfile.js

'use strict';

module.exports = (sequelize, DataTypes) => {
  const PlayerProfile = sequelize.define('PlayerProfile', {
    // Clé étrangère vers User
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id'
      },
      field: 'user_id'
    },
    
    // Informations personnelles étendues
    gender: {
      type: DataTypes.ENUM('male', 'female'),
      allowNull: false,
      validate: {
        isIn: [['male', 'female']]
      }
    },
    
    // Relation avec le college NJCAA
    collegeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'njcaa_colleges',
        key: 'id'
      },
      field: 'college_id'
    },
    
    // Statuts du profil joueur
    profileCompletionStatus: {
      type: DataTypes.ENUM('basic', 'completed', 'premium'),
      defaultValue: 'basic',
      field: 'profile_completion_status'
    },
    
    // Visibilité du profil
    isProfileVisible: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // Invisible par défaut jusqu'à validation admin
      field: 'is_profile_visible'
    },
    
    // Métadonnées pour analytics
    profileViews: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'profile_views'
    },
    
    lastProfileUpdate: {
      type: DataTypes.DATE,
      field: 'last_profile_update'
    }
  }, {
    tableName: 'player_profiles',
    timestamps: true,
    underscored: true,
    
    indexes: [
      {
        fields: ['user_id'],
        unique: true
      },
      {
        fields: ['college_id']
      },
      {
        fields: ['gender']
      },
      {
        fields: ['profile_completion_status']
      },
      {
        fields: ['is_profile_visible']
      }
    ]
  });

  // Méthodes d'instance
  PlayerProfile.prototype.incrementViews = async function() {
    this.profileViews += 1;
    await this.save({ fields: ['profileViews'] });
  };

  PlayerProfile.prototype.updateLastProfileUpdate = async function() {
    this.lastProfileUpdate = new Date();
    await this.save({ fields: ['lastProfileUpdate'] });
  };

  PlayerProfile.prototype.toPublicJSON = function() {
    const values = Object.assign({}, this.dataValues);
    // Supprimer les informations sensibles si nécessaire
    return values;
  };

  // Méthodes statiques
  PlayerProfile.findVisibleProfiles = async function(options = {}) {
    return await this.findAll({
      where: { 
        isProfileVisible: true,
        ...options.where
      },
      include: options.include || [],
      order: options.order || [['profileViews', 'DESC']]
    });
  };

  // Associations
  PlayerProfile.associate = function(models) {
    // Un profil joueur appartient à un utilisateur (relation 1:1)
    PlayerProfile.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    
    // Un profil joueur appartient à un college NJCAA
    PlayerProfile.belongsTo(models.NJCAACollege, {
      foreignKey: 'collegeId',
      as: 'college'
    });
    
    // Un joueur peut être favori de plusieurs coachs (relation M:M)
    PlayerProfile.belongsToMany(models.CoachProfile, {
      through: 'coach_favorites',
      as: 'favoriteByCoaches',
      foreignKey: 'playerProfileId',
      otherKey: 'coachProfileId'
    });
  };

  return PlayerProfile;
};