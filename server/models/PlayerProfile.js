// portall/server/models/PlayerProfile.js

'use strict';

module.exports = (sequelize, DataTypes) => {
  const PlayerProfile = sequelize.define('PlayerProfile', {
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
    
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'date_of_birth',
      validate: {
        isDate: true,
        isBefore: new Date().toISOString().split('T')[0]
      }
    },
    
    height: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 140,
        max: 220
      },
      comment: 'Height in centimeters'
    },
    
    weight: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 40,
        max: 150
      },
      comment: 'Weight in kilograms'
    },
    
    position: {
      type: DataTypes.ENUM(
        'goalkeeper', 'defender', 'midfielder', 'forward',
        'center_back', 'full_back', 'wing_back', 'defensive_midfielder',
        'central_midfielder', 'attacking_midfielder', 'winger', 'striker'
      ),
      allowNull: false
    },
    
    gender: {
      type: DataTypes.ENUM('male', 'female'),
      allowNull: false
    },
    
    collegeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'njcaa_colleges',
        key: 'id'
      },
      field: 'college_id'
    },
    
    currentYear: {
      type: DataTypes.ENUM('freshman', 'sophomore', 'junior', 'senior'),
      allowNull: false,
      field: 'current_year'
    },
    
    graduationYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'graduation_year',
      validate: {
        min: 2024,
        max: 2030
      }
    },
    
    isProfileVisible: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_profile_visible'
    },
    
    profileViews: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'profile_views'
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
        fields: ['position']
      },
      {
        fields: ['gender']
      },
      {
        fields: ['graduation_year']
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

  PlayerProfile.prototype.getAge = function() {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
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

  // ✅ ASSOCIATIONS COMPLÈTES
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
    
    // ✅ NOUVEAU : Un joueur peut avoir plusieurs évaluations NJCAA
    PlayerProfile.hasMany(models.PlayerEvaluation, {
      foreignKey: 'playerProfileId',
      as: 'njcaaEvaluations'
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