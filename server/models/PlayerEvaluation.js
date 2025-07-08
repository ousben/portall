// portall/server/models/PlayerEvaluation.js

'use strict';

module.exports = (sequelize, DataTypes) => {
  const PlayerEvaluation = sequelize.define('PlayerEvaluation', {
    // ✅ CORRECTION : Utiliser des noms cohérents avec le contrôleur
    playerProfileId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'player_profiles',
        key: 'id'
      },
      field: 'player_profile_id'
    },
    
    njcaaCoachProfileId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'njcaa_coach_profiles',
        key: 'id'
      },
      field: 'njcaa_coach_profile_id'
    },
    
    // Critères d'évaluation techniques (notes de 1 à 10)
    speed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      }
    },
    
    agility: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      }
    },
    
    ballControl: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      },
      field: 'ball_control'
    },
    
    passing: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      }
    },
    
    shooting: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      }
    },
    
    defending: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      }
    },
    
    gameIntelligence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      },
      field: 'game_intelligence'
    },
    
    workEthic: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      },
      field: 'work_ethic'
    },
    
    physicalFitness: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      },
      field: 'physical_fitness'
    },
    
    leadership: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      }
    },
    
    overallScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      },
      field: 'overall_score'
    },
    
    // Informations métier
    availableToTransfer: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'available_to_transfer'
    },
    
    expectedGraduationDate: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 2024,
        max: 2030
      },
      field: 'expected_graduation_date'
    },
    
    // Commentaires textuels
    coachabilityComment: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 500]
      },
      field: 'coachability_comment'
    },
    
    technique: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 500]
      }
    },
    
    physique: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 500]
      }
    },
    
    coachFinalComment: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [20, 1500]
      },
      field: 'coach_final_comment'
    },
    
    // Métadonnées
    evaluationVersion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'evaluation_version'
    },
    
    evaluationDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'evaluation_date'
    }
  }, {
    tableName: 'player_evaluations',
    timestamps: true,
    underscored: true,
    
    indexes: [
      {
        fields: ['player_profile_id']
      },
      {
        fields: ['njcaa_coach_profile_id']
      },
      {
        fields: ['player_profile_id', 'njcaa_coach_profile_id'],
        unique: true
      },
      {
        fields: ['available_to_transfer']
      }
    ]
  });

  // Méthodes statiques
  PlayerEvaluation.findByPlayerAndCoach = async function(playerProfileId, njcaaCoachProfileId) {
    return await this.findOne({
      where: {
        playerProfileId: playerProfileId,
        njcaaCoachProfileId: njcaaCoachProfileId
      }
    });
  };

  // ✅ ASSOCIATIONS CORRIGÉES
  PlayerEvaluation.associate = function(models) {
    // Une évaluation appartient à un joueur
    PlayerEvaluation.belongsTo(models.PlayerProfile, {
      foreignKey: 'playerProfileId',
      as: 'player'
    });
    
    // Une évaluation appartient à un coach NJCAA  
    PlayerEvaluation.belongsTo(models.NJCAACoachProfile, {
      foreignKey: 'njcaaCoachProfileId',
      as: 'njcaaCoach'
    });
  };

  return PlayerEvaluation;
};