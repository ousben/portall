// portall/server/models/NJCAACoachProfile.js

'use strict';

module.exports = (sequelize, DataTypes) => {
  const NJCAACoachProfile = sequelize.define('NJCAACoachProfile', {
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
    
    // Informations professionnelles spécifiques aux coachs NJCAA
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
    
    // Relation avec le college NJCAA (différent des coachs NCAA)
    collegeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'njcaa_colleges',
        key: 'id'
      },
      field: 'college_id'
    },
    
    // Division NJCAA spécifique
    division: {
      type: DataTypes.ENUM('njcaa_d1', 'njcaa_d2', 'njcaa_d3'),
      allowNull: false,
      validate: {
        isIn: [['njcaa_d1', 'njcaa_d2', 'njcaa_d3']]
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
    
    // Métriques d'évaluation
    totalEvaluations: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_evaluations'
    },
    
    lastEvaluationDate: {
      type: DataTypes.DATE,
      field: 'last_evaluation_date'
    }
  }, {
    tableName: 'njcaa_coach_profiles',
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
        fields: ['college_id', 'team_sport']
      }
    ]
  });

  // Méthodes d'instance spécifiques aux coachs NJCAA
  NJCAACoachProfile.prototype.incrementEvaluations = async function() {
    this.totalEvaluations += 1;
    this.lastEvaluationDate = new Date();
    await this.save({ fields: ['totalEvaluations', 'lastEvaluationDate'] });
  };

  // Récupérer les joueurs de ce coach (même college + même genre)
  NJCAACoachProfile.prototype.getMyPlayers = async function() {
    const { PlayerProfile, User, NJCAACollege } = require('../models');
    
    // Déterminer le genre des joueurs selon l'équipe du coach
    const playerGender = this.teamSport === 'mens_soccer' ? 'male' : 'female';
    
    return await PlayerProfile.findAll({
      where: {
        collegeId: this.collegeId,
        gender: playerGender,
        isProfileVisible: true // Seulement les profils actifs
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'isActive']
        },
        {
          model: NJCAACollege,
          as: 'college',
          attributes: ['id', 'name', 'state']
        }
      ],
      order: [['created_at', 'DESC']]
    });
  };

  NJCAACoachProfile.prototype.toPublicJSON = function() {
    const values = Object.assign({}, this.dataValues);
    // Les coachs NJCAA n'ont pas d'informations sensibles à cacher
    return values;
  };

  // Associations
  NJCAACoachProfile.associate = function(models) {
    // Relation 1:1 avec User
    NJCAACoachProfile.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    
    // Relation N:1 avec NJCAACollege
    NJCAACoachProfile.belongsTo(models.NJCAACollege, {
      foreignKey: 'collegeId',
      as: 'college'
    });
  };

  return NJCAACoachProfile;
};