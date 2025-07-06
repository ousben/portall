// portall/server/models/PlayerEvaluation.js

'use strict';

module.exports = (sequelize, DataTypes) => {
  const PlayerEvaluation = sequelize.define('PlayerEvaluation', {
    // Relations avec les autres entités
    playerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'player_profiles',
        key: 'id'
      },
      field: 'player_id'
    },
    
    coachId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'njcaa_coach_profiles',
        key: 'id'
      },
      field: 'coach_id'
    },
    
    // Critères d'évaluation selon tes spécifications exactes
    availableToTransfer: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'available_to_transfer',
      comment: 'Le joueur est-il disponible pour un transfert vers NCAA/NAIA ?'
    },
    
    roleInTeam: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'role_in_team',
      validate: {
        len: [5, 500] // Entre 5 et 500 caractères pour assurer un minimum de détail
      },
      comment: 'Rôle spécifique du joueur dans l\'équipe (position, responsabilités)'
    },
    
    expectedGraduationDate: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'expected_graduation_date',
      validate: {
        min: new Date().getFullYear(), // Pas de date dans le passé
        max: new Date().getFullYear() + 6 // Maximum 6 ans dans le futur
      },
      comment: 'Année de diplôme prévue'
    },
    
    performanceLevel: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'performance_level',
      validate: {
        len: [10, 1000] // Encourager des réponses détaillées
      },
      comment: 'Niveau auquel le coach estime que le joueur peut performer'
    },
    
    playerStrengths: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'player_strengths',
      validate: {
        len: [10, 1000]
      },
      comment: 'Points forts identifiés par le coach'
    },
    
    improvementAreas: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'improvement_areas',
      validate: {
        len: [10, 1000]
      },
      comment: 'Domaines où le joueur devrait se concentrer pour s\'améliorer'
    },
    
    mentality: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 500]
      },
      comment: 'Évaluation de l\'état d\'esprit et de la mentalité du joueur'
    },
    
    coachability: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 500]
      },
      comment: 'Capacité du joueur à recevoir et appliquer les conseils'
    },
    
    technique: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 500]
      },
      comment: 'Évaluation des compétences techniques du joueur'
    },
    
    physique: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 500]
      },
      comment: 'Évaluation des capacités physiques du joueur'
    },
    
    coachFinalComment: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'coach_final_comment',
      validate: {
        len: [20, 1500] // Commentaire final plus substantiel
      },
      comment: 'Commentaire final et recommandations du coach'
    },
    
    // Métadonnées pour le versioning et l'historique
    evaluationVersion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'evaluation_version',
      comment: 'Numéro de version de cette évaluation'
    },
    
    isCurrent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_current',
      comment: 'Cette évaluation est-elle la version actuelle ?'
    },
    
    evaluationDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'evaluation_date',
      comment: 'Date à laquelle l\'évaluation a été effectuée'
    }
  }, {
    tableName: 'player_evaluations',
    timestamps: true,
    underscored: true,
    
    // Index définis au niveau du modèle
    indexes: [
      {
        fields: ['player_id']
      },
      {
        fields: ['coach_id']
      },
      {
        fields: ['is_current']
      },
      {
        fields: ['player_id', 'is_current'],
        unique: true, // Un seul évaluation "current" par joueur
        name: 'unique_current_evaluation_per_player'
      },
      {
        fields: ['available_to_transfer', 'is_current']
      }
    ],
    
    // Hooks pour maintenir la cohérence des données
    hooks: {
      beforeCreate: async (evaluation, options) => {
        // Quand on crée une nouvelle évaluation, marquer les anciennes comme non-current
        if (evaluation.isCurrent) {
          await PlayerEvaluation.update(
            { isCurrent: false },
            {
              where: {
                playerId: evaluation.playerId,
                isCurrent: true
              },
              transaction: options.transaction
            }
          );
        }
      },
      
      beforeUpdate: async (evaluation, options) => {
        // Si on marque cette évaluation comme current, désactiver les autres
        if (evaluation.changed('isCurrent') && evaluation.isCurrent) {
          await PlayerEvaluation.update(
            { isCurrent: false },
            {
              where: {
                playerId: evaluation.playerId,
                isCurrent: true,
                id: { [sequelize.Sequelize.Op.ne]: evaluation.id }
              },
              transaction: options.transaction
            }
          );
        }
      }
    }
  });

  // Méthodes statiques pour les requêtes métier
  PlayerEvaluation.getCurrentEvaluationForPlayer = async function(playerId) {
    return await this.findOne({
      where: {
        playerId: playerId,
        isCurrent: true
      },
      include: [
        {
          model: sequelize.models.NJCAACoachProfile,
          as: 'coach',
          include: [{
            model: sequelize.models.User,
            as: 'user',
            attributes: ['firstName', 'lastName']
          }]
        }
      ]
    });
  };

  PlayerEvaluation.getAvailablePlayersForTransfer = async function(filters = {}) {
    const where = {
      availableToTransfer: true,
      isCurrent: true
    };
    
    // Ajouter des filtres optionnels
    if (filters.expectedGraduationYear) {
      where.expectedGraduationDate = filters.expectedGraduationYear;
    }
    
    return await this.findAll({
      where,
      include: [
        {
          model: sequelize.models.PlayerProfile,
          as: 'player',
          include: [
            {
              model: sequelize.models.User,
              as: 'user',
              attributes: ['firstName', 'lastName']
            },
            {
              model: sequelize.models.NJCAACollege,
              as: 'college',
              attributes: ['name', 'state']
            }
          ]
        },
        {
          model: sequelize.models.NJCAACoachProfile,
          as: 'coach',
          include: [{
            model: sequelize.models.User,
            as: 'user',
            attributes: ['firstName', 'lastName']
          }]
        }
      ],
      order: [['evaluationDate', 'DESC']]
    });
  };

  // Méthodes d'instance
  PlayerEvaluation.prototype.createNewVersion = async function(updateData, transaction = null) {
    // Marquer cette évaluation comme non-current
    await this.update({ isCurrent: false }, { transaction });
    
    // Créer une nouvelle version
    const newVersion = await PlayerEvaluation.create({
      ...this.dataValues,
      ...updateData,
      id: undefined, // Laisser auto-increment générer un nouvel ID
      evaluationVersion: this.evaluationVersion + 1,
      isCurrent: true,
      evaluationDate: new Date(),
      createdAt: undefined,
      updatedAt: undefined
    }, { transaction });
    
    return newVersion;
  };

  PlayerEvaluation.prototype.toPublicJSON = function() {
    const values = Object.assign({}, this.dataValues);
    // Retirer les métadonnées techniques si nécessaire
    delete values.evaluationVersion;
    return values;
  };

  // Associations avec les autres modèles
  PlayerEvaluation.associate = function(models) {
    // Une évaluation appartient à un joueur
    PlayerEvaluation.belongsTo(models.PlayerProfile, {
      foreignKey: 'playerId',
      as: 'player'
    });
    
    // Une évaluation appartient à un coach NJCAA
    PlayerEvaluation.belongsTo(models.NJCAACoachProfile, {
      foreignKey: 'coachId',
      as: 'coach'
    });
  };

  return PlayerEvaluation;
};