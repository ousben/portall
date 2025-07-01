// portall/server/models/CoachProfile.js

'use strict';

module.exports = (sequelize, DataTypes) => {
  const CoachProfile = sequelize.define('CoachProfile', {
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
    
    // Informations professionnelles spécifiques aux coachs
    position: {
      type: DataTypes.ENUM('head_coach', 'assistant_coach'),
      allowNull: false,
      validate: {
        isIn: [['head_coach', 'assistant_coach']]
      }
    },
    
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        is: /^\+?[\d\s\-\(\)]+$/, // Format téléphone flexible
        len: [10, 20]
      },
      field: 'phone_number'
    },
    
    // Relation avec le college NCAA
    collegeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'ncaa_colleges',
        key: 'id'
      },
      field: 'college_id'
    },
    
    // Division NCAA spécifique
    division: {
      type: DataTypes.ENUM('ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia'),
      allowNull: false,
      validate: {
        isIn: [['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia']]
      }
    },
    
    // Sport et genre de l'équipe
    teamSport: {
      type: DataTypes.ENUM('mens_soccer', 'womens_soccer'),
      allowNull: false,
      field: 'team_sport',
      validate: {
        isIn: [['mens_soccer', 'womens_soccer']]
      }
    },
    
    // Recherches sauvegardées et métriques
    savedSearches: {
      type: DataTypes.JSON,
      defaultValue: [],
      field: 'saved_searches'
    },
    
    totalSearches: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_searches'
    }
  }, {
    tableName: 'coach_profiles',
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
        fields: ['division']
      },
      {
        fields: ['team_sport']
      },
      {
        fields: ['position']
      }
    ]
  });

  // Méthodes d'instance
  CoachProfile.prototype.incrementSearches = async function() {
    this.totalSearches += 1;
    await this.save({ fields: ['totalSearches'] });
  };

  CoachProfile.prototype.saveSearch = async function(searchCriteria) {
    const searches = [...this.savedSearches];
    searches.push({
      ...searchCriteria,
      savedAt: new Date(),
      id: Date.now() // Simple ID basé sur timestamp
    });
    
    // Garder seulement les 10 dernières recherches
    if (searches.length > 10) {
      searches.shift();
    }
    
    this.savedSearches = searches;
    await this.save({ fields: ['savedSearches'] });
  };

  CoachProfile.prototype.toPublicJSON = function() {
    const values = Object.assign({}, this.dataValues);
    // Supprimer les informations sensibles
    delete values.phoneNumber; // Numéro de téléphone privé par défaut
    return values;
  };

  // Méthodes statiques
  CoachProfile.findByDivision = async function(division) {
    return await this.findAll({
      where: { division: division },
      include: ['user', 'college']
    });
  };

  // Associations
  CoachProfile.associate = function(models) {
    // Un profil coach appartient à un utilisateur (relation 1:1)
    CoachProfile.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    
    // Un profil coach appartient à un college NCAA
    CoachProfile.belongsTo(models.NCAACollege, {
      foreignKey: 'collegeId',
      as: 'college'
    });
    
    // Un coach peut avoir plusieurs joueurs favoris (relation M:M)
    CoachProfile.belongsToMany(models.PlayerProfile, {
      through: 'coach_favorites',
      as: 'favoriteProfiles',
      foreignKey: 'coachProfileId',
      otherKey: 'playerProfileId'
    });
  };

  return CoachProfile;
};